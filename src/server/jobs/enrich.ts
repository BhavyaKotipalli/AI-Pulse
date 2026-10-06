import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { ArticleAnalysisSchema, PaperAnalysisSchema, RepoAnalysisSchema, type ItemAnalysis } from "@/domain/analysis";
import { validateClaims } from "@/domain/citations";
import { computeScore, DEEP_ANALYSIS_THRESHOLD } from "@/domain/scoring";
import { CATEGORIES, CLAIM_LABELS, CONFIDENCE_LEVELS } from "@/domain/taxonomy";
import type { logger as Logger } from "@/lib/logger";
import { ai, type Gateway } from "@/server/ai/gateway";
import { getDb } from "@/server/db/client";
import { items, sources, storyClusters } from "@/server/db/schema";
import { BudgetExceededError, RateLimitError } from "@/services/ai/types";

const score100 = z.number().min(0).max(100);

export const ClassificationSchema = z.object({
  items: z.array(
    z.object({
      ref: z.string(),
      category: z.enum(CATEGORIES),
      tldr: z.string().max(420).nullable(),
      whyItMatters: z.string().max(420),
      tags: z.array(z.string().max(40)).max(6),
      impact: score100,
      novelty: score100,
      technical: score100,
      industry: score100,
      career: score100,
      clickbait: z.number().min(0).max(1),
    }),
  ),
});

const CLASSIFY_SYSTEM = `You are the triage analyst for AI Pulse, an AI and technology intelligence service.
For each item you receive ONLY a title, source and short excerpt. Judge it for an audience of AI engineers, software engineers, researchers, students and founders.

Rules:
- tldr: one or two sentences stating what happened, using ONLY information in the title/excerpt. If the excerpt is missing or says nothing beyond the title, return null. Never add facts, numbers or names that are not in the input.
- whyItMatters: one sentence of analysis on the practical significance. This is your judgment, so it may use general background knowledge, but must not assert unverifiable specifics.
- Scores are 0-100 and should use the full range. Most items are routine (30-55). Reserve 80+ for developments that change what practitioners can build or must know: major model or product releases from leading labs, landmark papers, significant policy. A funding round or incremental update is rarely above 65.
- impact: breadth and depth of real-world effect. novelty: how new the idea or capability is. technical: technical depth and significance. industry: relevance to companies and the market. career: relevance to skills and jobs.
- clickbait: 0 for sober reporting, 1 for sensational or unsupported claims.
- tags: up to 6 short lowercase topic tags.
Return one entry per item, echoing its ref exactly.`;

const LlmClaim = z.object({ text: z.string(), label: z.enum(CLAIM_LABELS), confidence: z.enum(CONFIDENCE_LEVELS) });
const claims = z.array(LlmClaim).min(1).max(6);
const ArticleOut = ArticleAnalysisSchema.omit({ kind: true, claims: true }).extend({ claims });
const PaperOut = PaperAnalysisSchema.omit({ kind: true, claims: true }).extend({ claims });
const RepoOut = RepoAnalysisSchema.omit({ kind: true, claims: true }).extend({ claims });

const ANALYSIS_SYSTEM = `You are a senior AI research analyst writing for AI Pulse.
You are given the title, source, date and a SHORT EXCERPT of one item - not the full text. Write an analysis that helps a practitioner understand it and act on it.

Trust rules (strict):
- claims: label "fact" ONLY for statements directly supported by the title or excerpt. Label reasoning as "analysis" and forward-looking statements as "speculation". When unsure, use "analysis".
- Explanations may draw on general background knowledge of the field, but must not invent specific numbers, benchmark results, quotes, dates, funding amounts or names that are not in the input. If a detail is unknown, say it is not stated in the excerpt.
- audiences: one concrete sentence for each of students, aiEngineers, softwareEngineers, researchers, founders, companies.
- action: a realistic next step and a small hands-on experiment with an honest time estimate.
- beginner: explain it to a smart newcomer with no jargon.
Be specific and concise. No marketing language.`;

interface Stats {
  reembedded: number;
  classified: number;
  classifyFailed: number;
  analyzed: number;
  analyzeFailed: number;
  stopped?: string;
}

const isQuotaStop = (err: unknown) => err instanceof RateLimitError || err instanceof BudgetExceededError;
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Re-embeds items whose vectors came from a different embedding model (e.g. after adding an API key). */
async function reembed(gw: Gateway, deadline: number, stats: Stats) {
  const db = getDb();
  while (Date.now() < deadline) {
    const batch = await db
      .select({ id: items.id, title: items.title, snippet: items.snippet, tldr: items.tldr, tags: items.tags })
      .from(items)
      .where(or(isNull(items.embeddingModel), ne(items.embeddingModel, gw.embeddingModel)))
      .orderBy(desc(items.publishedAt))
      .limit(48);
    if (batch.length === 0) return;
    const vectors = await gw.embed(
      batch.map((b) => [b.title, b.tldr ?? "", b.snippet ?? "", b.tags.join(" ")].join("\n")),
      "document",
    );
    for (const [i, row] of batch.entries()) {
      await db.update(items).set({ embedding: vectors[i], embeddingModel: gw.embeddingModel }).where(eq(items.id, row.id));
    }
    stats.reembedded += batch.length;
  }
}

const CLASSIFY_BATCH = 8;

async function classify(gw: Gateway, deadline: number, stats: Stats, log: typeof Logger) {
  const db = getDb();
  while (Date.now() < deadline) {
    const batch = await db
      .select({
        id: items.id,
        kind: items.kind,
        title: items.title,
        snippet: items.snippet,
        publishedAt: items.publishedAt,
        breakdown: items.scoreBreakdown,
        sourceName: sources.name,
        credibility: sources.credibility,
        sourceCount: storyClusters.sourceCount,
      })
      .from(items)
      .leftJoin(sources, eq(items.sourceId, sources.id))
      .leftJoin(storyClusters, eq(items.clusterId, storyClusters.id))
      .where(and(eq(items.status, "normalized"), eq(items.isDemo, false), gte(items.publishedAt, new Date(Date.now() - 7 * 86_400_000))))
      .orderBy(desc(items.score))
      .limit(CLASSIFY_BATCH);
    if (batch.length === 0) return;

    const prompt = batch
      .map(
        (it, i) =>
          `<item ref="i${i + 1}" kind="${it.kind}" source="${it.sourceName ?? "unknown"}">\n<title>${it.title}</title>\n<excerpt>${it.snippet ?? ""}</excerpt>\n</item>`,
      )
      .join("\n");

    let result: z.infer<typeof ClassificationSchema>;
    try {
      result = await gw.llm.generateObject(
        { tier: "fast", task: "classify", system: CLASSIFY_SYSTEM, messages: [{ role: "user", content: prompt }], maxOutputTokens: 4096 },
        ClassificationSchema,
      );
    } catch (err) {
      if (isQuotaStop(err)) throw err;
      // A malformed batch must not block the queue forever: mark it failed and move on.
      log.warn({ err: message(err), size: batch.length }, "classification batch failed");
      await db.update(items).set({ status: "enrich_failed" }).where(inArray(items.id, batch.map((b) => b.id)));
      stats.classifyFailed += batch.length;
      continue;
    }

    const byRef = new Map(result.items.map((r) => [r.ref, r]));
    for (const [i, it] of batch.entries()) {
      const r = byRef.get(`i${i + 1}`);
      if (!r) {
        await db.update(items).set({ status: "enrich_failed" }).where(eq(items.id, it.id));
        stats.classifyFailed++;
        continue;
      }
      const breakdown = computeScore({
        sub: { impact: r.impact, novelty: r.novelty, technical: r.technical, industry: r.industry, career: r.career, clickbait: r.clickbait },
        sourceCredibility: it.credibility ?? 0.6,
        corroboratingSources: it.sourceCount ?? 1,
        momentum: it.breakdown?.dimensions.momentum ?? 20,
        publishedAt: it.publishedAt,
        method: "llm",
      });
      await db
        .update(items)
        .set({
          category: r.category,
          // A summary may only come from the excerpt; without one we keep whatever ingestion derived.
          ...(r.tldr && it.snippet ? { tldr: r.tldr } : {}),
          whyItMatters: r.whyItMatters,
          tags: r.tags.map((t) => t.toLowerCase()),
          score: breakdown.score,
          scoreBreakdown: breakdown,
          status: "enriched",
        })
        .where(eq(items.id, it.id));
      stats.classified++;
    }
  }
}

function analysisSchemaFor(kind: string) {
  if (kind === "paper") return { schema: PaperOut, kind: "paper" as const };
  if (kind === "repo") return { schema: RepoOut, kind: "repo" as const };
  return { schema: ArticleOut, kind: "article" as const };
}

async function analyze(gw: Gateway, deadline: number, stats: Stats, log: typeof Logger, maxItems: number) {
  const db = getDb();
  const queue = await db
    .select({
      id: items.id,
      kind: items.kind,
      title: items.title,
      snippet: items.snippet,
      tldr: items.tldr,
      url: items.url,
      publishedAt: items.publishedAt,
      sourceName: sources.name,
      metrics: items.metrics,
    })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .where(
      and(
        eq(items.status, "enriched"),
        eq(items.isDemo, false),
        isNull(items.analysis),
        gte(items.score, DEEP_ANALYSIS_THRESHOLD),
        gte(items.publishedAt, new Date(Date.now() - 5 * 86_400_000)),
        // Without an excerpt there is nothing to ground an analysis in.
        sql`length(coalesce(${items.snippet}, '')) > 80`,
      ),
    )
    .orderBy(desc(items.score))
    .limit(maxItems);

  for (const it of queue) {
    if (Date.now() >= deadline) return;
    const { schema, kind } = analysisSchemaFor(it.kind);
    const prompt = `<item kind="${it.kind}" source="${it.sourceName ?? "unknown"}" published="${it.publishedAt.toISOString().slice(0, 10)}">
<title>${it.title}</title>
<excerpt>${it.snippet ?? ""}</excerpt>
${it.metrics.stars ? `<stars>${it.metrics.stars}</stars>` : ""}${it.metrics.authors?.length ? `<authors>${it.metrics.authors.join(", ")}</authors>` : ""}
</item>`;
    try {
      const out = await gw.llm.generateObject(
        { tier: "strong", task: "analyze", system: ANALYSIS_SYSTEM, messages: [{ role: "user", content: prompt }], maxOutputTokens: 6000 },
        schema as z.ZodType<z.infer<typeof ArticleOut> | z.infer<typeof PaperOut> | z.infer<typeof RepoOut>>,
      );
      // The only source the model saw is this item: facts and analysis cite it, speculation cites nothing.
      const withSources = out.claims.map((c) => ({ ...c, sourceItemIds: c.label === "speculation" ? [] : [it.id] }));
      const analysis = { ...out, kind, claims: validateClaims(withSources, new Set([it.id])) } as ItemAnalysis;
      await db.update(items).set({ analysis }).where(eq(items.id, it.id));
      stats.analyzed++;
    } catch (err) {
      if (isQuotaStop(err)) throw err;
      log.warn({ err: message(err), itemId: it.id }, "deep analysis failed");
      stats.analyzeFailed++;
    }
  }
}

/**
 * LLM enrichment, safe to run repeatedly: each run picks up where the last stopped.
 * Stops cleanly at the time budget (serverless limit) or when a rate/daily limit is hit.
 */
export async function runEnrich(log: typeof Logger, opts: { budgetMs?: number; maxAnalyses?: number } = {}): Promise<Record<string, unknown>> {
  const gw = ai();
  const stats: Stats = { reembedded: 0, classified: 0, classifyFailed: 0, analyzed: 0, analyzeFailed: 0 };
  const deadline = Date.now() + (opts.budgetMs ?? 230_000);

  try {
    await reembed(gw, deadline, stats);
  } catch (err) {
    if (!isQuotaStop(err)) throw err;
    stats.stopped = message(err);
  }
  if (gw.llm.isMock) return { ...stats, skipped: "No AI provider configured — classification and analysis need an API key." };
  if (stats.stopped) return { ...stats };

  try {
    await classify(gw, deadline, stats, log);
    await analyze(gw, deadline, stats, log, opts.maxAnalyses ?? 12);
  } catch (err) {
    if (!isQuotaStop(err)) throw err;
    stats.stopped = message(err);
    log.info({ reason: stats.stopped }, "enrichment paused");
  }
  const [pending] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(items)
    .where(and(eq(items.status, "normalized"), eq(items.isDemo, false), gte(items.publishedAt, new Date(Date.now() - 7 * 86_400_000))));
  return { ...stats, pendingClassification: pending?.n ?? 0 };
}
