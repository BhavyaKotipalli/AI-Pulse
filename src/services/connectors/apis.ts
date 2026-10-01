import { z } from "zod";
import { fetchJson, fetchText } from "./http";
import { parseFeed } from "./rss";
import type { RawItem, SourceConnector } from "./types";

/** Maps a raw count onto 0–100 with diminishing returns (log scale). */
export function logMomentum(value: number, saturation: number): number {
  if (value <= 0) return 0;
  return Math.min(100, Math.round((Math.log1p(value) / Math.log1p(saturation)) * 100));
}

// ─── arXiv ─────────────────────────────────────────────────────────────────

const ARXIV_CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.CV", "cs.RO", "cs.MA"];

export const arxivConnector: SourceConnector = {
  id: "arxiv",
  async fetch(source, ctx) {
    // arXiv asks clients to keep request rates low; one query per run.
    const query = ARXIV_CATEGORIES.map((c) => `cat:${c}`).join("+OR+");
    const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=40`;
    const xml = await fetchText(url, { signal: ctx.signal, timeoutMs: 25_000 });
    return parseFeed(xml, { ...source, itemKind: "paper" })
      .filter((i) => i.publishedAt >= ctx.since)
      .map((i) => {
        const arxivId = i.url.match(/abs\/([\w.]+?)(v\d+)?$/)?.[1];
        return {
          ...i,
          url: arxivId ? `https://arxiv.org/abs/${arxivId}` : i.url,
          externalId: arxivId ?? i.externalId,
          metrics: { arxivId, authors: i.author?.split(", ").slice(0, 6) },
          momentum: 10,
        };
      });
  },
};

// ─── Hugging Face Daily Papers ─────────────────────────────────────────────

const HfPaper = z.object({
  publishedAt: z.string(),
  paper: z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string().default(""),
    upvotes: z.number().default(0),
    authors: z.array(z.object({ name: z.string() })).default([]),
    githubRepo: z.string().nullish(),
  }),
});

export const hfPapersConnector: SourceConnector = {
  id: "hf_papers",
  async fetch(_source, ctx) {
    const data = z.array(z.unknown()).parse(await fetchJson("https://huggingface.co/api/daily_papers?limit=50", { signal: ctx.signal }));
    const out: RawItem[] = [];
    for (const raw of data) {
      const parsed = HfPaper.safeParse(raw);
      if (!parsed.success) continue;
      const { paper, publishedAt } = parsed.data;
      const date = new Date(publishedAt);
      if (Number.isNaN(date.getTime()) || date < ctx.since) continue;
      out.push({
        externalId: paper.id,
        kind: "paper",
        title: paper.title,
        url: `https://arxiv.org/abs/${paper.id}`,
        author: paper.authors.slice(0, 3).map((a) => a.name).join(", ") + (paper.authors.length > 3 ? ", et al." : ""),
        publishedAt: date,
        summary: paper.summary,
        metrics: { arxivId: paper.id, authors: paper.authors.slice(0, 6).map((a) => a.name) },
        momentum: logMomentum(paper.upvotes, 150),
      });
    }
    return out;
  },
};

// ─── Hacker News (Algolia) ─────────────────────────────────────────────────

const HnHit = z.object({
  objectID: z.string(),
  title: z.string(),
  url: z.string().url().nullish(),
  points: z.number().nullish(),
  num_comments: z.number().nullish(),
  created_at: z.string(),
  author: z.string().nullish(),
});

/** Only AI/tech-relevant front-page stories are kept. */
export const AI_TOPIC_PATTERN =
  /\b(ai|a\.i\.|llms?|gpt[-\w.]*|claude|gemini|llama|mistral|openai|anthropic|deepmind|hugging ?face|nvidia|transformers?|neural|machine learning|ml|diffusion|agents?|agentic|rag|embeddings?|inference|gpus?|copilot|chatbot|reasoning model|fine-?tun\w*|mcp|robot\w*|deepseek|qwen)\b/i;

export const hnConnector: SourceConnector = {
  id: "hn",
  async fetch(source, ctx) {
    const since = Math.floor(ctx.since.getTime() / 1000);
    const url = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=points>60,created_at_i>${since}&hitsPerPage=200`;
    const data = z.object({ hits: z.array(z.unknown()) }).parse(await fetchJson(url, { signal: ctx.signal }));
    const out: RawItem[] = [];
    for (const raw of data.hits) {
      const parsed = HnHit.safeParse(raw);
      if (!parsed.success) continue;
      const h = parsed.data;
      if (!(source.filter ?? AI_TOPIC_PATTERN).test(h.title)) continue;
      out.push({
        externalId: h.objectID,
        kind: "article",
        title: h.title,
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        author: h.author ?? null,
        publishedAt: new Date(h.created_at),
        summary: `Discussed on Hacker News: ${h.points ?? 0} points, ${h.num_comments ?? 0} comments (https://news.ycombinator.com/item?id=${h.objectID}).`,
        metrics: { hnPoints: h.points ?? 0, hnComments: h.num_comments ?? 0 },
        momentum: logMomentum(h.points ?? 0, 1500),
      });
    }
    return out;
  },
};

// ─── GitHub ────────────────────────────────────────────────────────────────

const GhRepo = z.object({
  id: z.number(),
  full_name: z.string(),
  html_url: z.string().url(),
  description: z.string().nullish(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  language: z.string().nullish(),
  topics: z.array(z.string()).default([]),
  created_at: z.string(),
  pushed_at: z.string(),
  owner: z.object({ login: z.string() }),
});

const GITHUB_TOPICS = ["llm", "ai-agents", "mcp", "rag", "generative-ai"];

export const githubConnector: SourceConnector = {
  id: "github",
  async fetch(_source, ctx) {
    const created = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (ctx.githubToken) headers.Authorization = `Bearer ${ctx.githubToken}`;
    const seen = new Map<number, RawItem>();
    // Sequential to respect the unauthenticated search limit (10 requests/minute).
    for (const topic of GITHUB_TOPICS) {
      const url = `https://api.github.com/search/repositories?q=topic:${topic}+created:>${created}+stars:>150&sort=stars&order=desc&per_page=15`;
      const data = z.object({ items: z.array(z.unknown()) }).parse(await fetchJson(url, { headers, signal: ctx.signal }));
      for (const raw of data.items) {
        const parsed = GhRepo.safeParse(raw);
        if (!parsed.success || seen.has(parsed.data.id)) continue;
        const r = parsed.data;
        const ageDays = Math.max(1, (Date.now() - new Date(r.created_at).getTime()) / 86_400_000);
        seen.set(r.id, {
          externalId: String(r.id),
          kind: "repo",
          title: r.full_name,
          url: r.html_url,
          author: r.owner.login,
          // Trending repos are "published" when they started trending; use last push for freshness.
          publishedAt: new Date(r.pushed_at),
          summary: r.description ?? "",
          tags: r.topics.slice(0, 8),
          metrics: {
            stars: r.stargazers_count,
            forks: r.forks_count,
            language: r.language ?? undefined,
            // Estimate until we have 7 days of our own snapshots: average daily stars since creation.
            starsDelta7d: Math.round((r.stargazers_count / ageDays) * Math.min(7, ageDays)),
          },
          // Star velocity saturates late: only exceptional repos (~2k stars/day) reach 100.
          momentum: logMomentum(r.stargazers_count / ageDays, 2000),
        });
      }
    }
    return [...seen.values()];
  },
};
