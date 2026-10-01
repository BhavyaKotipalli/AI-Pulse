import { describe, expect, it } from "vitest";
import { composeBriefing, type BriefingCandidate } from "./briefing";
import { buildEntityMatcher } from "./entity-matcher";
import { categorize, clickbaitScore, heuristicSubScores, inferKind } from "./heuristics";
import { canonicalUrl, cleanTitle, firstSentence, jaccard, makeSnippet, stripHtml, titleTokens } from "./normalize";
import { computeScore, rescore } from "./scoring";

describe("normalization", () => {
  it("canonicalizes URLs for dedup", () => {
    expect(canonicalUrl("http://www.Example.com/post/?utm_source=x&b=2&a=1#frag")).toBe("https://example.com/post?a=1&b=2");
    expect(canonicalUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("strips HTML to plain text", () => {
    expect(stripHtml("<p>Hello <b>world</b> &amp; <script>alert(1)</script>friends&#33;</p>")).toBe("Hello world & friends!");
  });

  it("keeps only a short snippet, cut on a boundary", () => {
    const long = "First sentence here. ".repeat(40);
    const snip = makeSnippet(long, 120)!;
    expect(snip.length).toBeLessThanOrEqual(120);
    expect(snip.endsWith(".")).toBe(true);
    expect(makeSnippet("")).toBeNull();
  });

  it("drops publication suffixes from titles", () => {
    expect(cleanTitle("Big model launch - The Verge")).toBe("Big model launch");
  });

  it("extracts the first sentence", () => {
    expect(firstSentence("This is the first full sentence. And another one.")).toBe("This is the first full sentence.");
  });

  it("detects near-duplicate titles", () => {
    const a = titleTokens("OpenAI releases GPT-6.1 Sol with faster reasoning");
    const b = titleTokens("OpenAI releases GPT-6.1 Sol, with faster reasoning");
    const c = titleTokens("Robotics startup raises Series B");
    expect(jaccard(a, b)).toBeGreaterThan(0.9);
    expect(jaccard(a, c)).toBeLessThan(0.1);
  });
});

describe("heuristic enrichment", () => {
  it("flags clickbait but not sober headlines with acronyms", () => {
    expect(clickbaitScore("AI will replace ALL programmers by next year!")).toBeGreaterThanOrEqual(0.6);
    expect(clickbaitScore("NVIDIA ships new GPU inference SDK for LLM serving")).toBe(0);
  });

  it("categorizes by content and kind", () => {
    expect(categorize("Startup raises $40M Series B", "article")).toBe("funding");
    expect(categorize("New benchmark for agents using MCP tools", "article")).toBe("agents");
    expect(categorize("anything", "paper")).toBe("research");
  });

  it("recognizes product launches", () => {
    expect(inferKind("Introducing GPT-6.1 Sol", "article")).toBe("launch");
    expect(inferKind("Claude now available in a new region", "article")).toBe("launch");
    expect(inferKind("Why evals matter", "article")).toBe("article");
    expect(inferKind("Introducing a dataset", "paper")).toBe("paper");
  });

  it("gives first-party lab announcements more impact than anonymous posts", () => {
    const base = { kind: "article" as const, title: "Introducing a new reasoning model", snippet: null, entityCount: 1, skillCount: 0 };
    expect(heuristicSubScores({ ...base, sourceCredibility: 0.95 }).impact).toBeGreaterThan(heuristicSubScores({ ...base, sourceCredibility: 0.6 }).impact);
  });

  it("rescoring a breakdown is stable and refreshes recency", () => {
    const published = new Date("2026-10-01T00:00:00Z");
    const b = computeScore({
      sub: { impact: 70, novelty: 60, technical: 50, industry: 60, career: 55, clickbait: 0.3 },
      sourceCredibility: 0.9,
      corroboratingSources: 1,
      momentum: 40,
      publishedAt: published,
      now: published,
      method: "heuristic",
    });
    expect(rescore(b, published, 1, published).score).toBe(b.score);
    const later = rescore(b, published, 1, new Date(published.getTime() + 72 * 3_600_000));
    expect(later.score).toBeLessThan(b.score);
    expect(later.method).toBe("heuristic");
    expect(rescore(b, published, 3, published).score).toBeGreaterThan(b.score);
  });
});

describe("entity matching", () => {
  const match = buildEntityMatcher([
    { id: "mcp", name: "Model Context Protocol", aliases: ["MCP"] },
    { id: "cursor", name: "Anysphere (Cursor)", aliases: [] },
    { id: "rag", name: "RAG", aliases: [] },
    { id: "gpt", name: "GPT", aliases: [] },
  ]);

  it("matches names, aliases and acronyms on word boundaries", () => {
    expect(match("Servers for the model context protocol")).toEqual(["mcp"]);
    expect(match("New MCP servers and GPT-6 support")).toEqual(["mcp", "gpt"]);
  });

  it("does not match acronyms inside ordinary words or in lowercase", () => {
    expect(match("a ragged edge, a drag race, mcp lowercase")).toEqual([]);
  });

  it("ignores parenthetical parts of names", () => {
    expect(match("Anysphere raises again")).toEqual(["cursor"]);
  });
});

describe("deterministic briefing", () => {
  const item = (id: string, kind: BriefingCandidate["kind"], score: number, extra: Partial<BriefingCandidate> = {}): BriefingCandidate => ({
    id,
    kind,
    score,
    title: `Title ${id} with several words`,
    tldr: `Summary of ${id}.`,
    whyItMatters: null,
    category: "models",
    ...extra,
  });

  it("selects the top story, sections and cites sources", () => {
    const b = composeBriefing({
      items: [
        item("a1", "article", 90),
        item("a2", "article", 80),
        item("p1", "paper", 85),
        item("r1", "repo", 50, { starsDelta7d: 900 }),
        item("r2", "repo", 70, { starsDelta7d: 100 }),
        item("c1", "article", 60, { category: "careers" }),
      ],
      totalItemsConsidered: 6,
      trends: [{ slug: "t", title: "Trend", thesis: "Thesis.", status: "accelerating", momentum: 0.8, evidenceItemIds: ["a1"] }],
      skills: [{ name: "MCP", status: "exploding", growth: 1.2, evidenceItemIds: ["a2"] }],
      hourUtc: 6,
    })!;
    expect(b.greeting).toBe("Good morning");
    expect(b.headline.itemId).toBe("a1");
    expect(b.topStoryIds).toEqual(["a2", "c1"]);
    expect(b.researchItemId).toBe("p1");
    expect(b.repoItemId).toBe("r1"); // fastest-growing, not highest score
    expect(b.jobs[0]).toMatchObject({ label: "fact", sourceItemIds: ["c1"] });
    expect(b.jobs[1]?.label).toBe("analysis");
    expect(b.payAttention[0]?.sourceItemIds).toEqual(["a1"]);
    expect(b.skill?.name).toBe("MCP");
  });

  it("returns null when there are no stories", () => {
    expect(composeBriefing({ items: [item("p", "paper", 90)], totalItemsConsidered: 1, trends: [], skills: [] })).toBeNull();
  });
});
