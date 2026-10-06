import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { ZodType } from "zod";
import type { GenerateRequest, GenerateResult, LLMProvider } from "@/services/ai/types";
import type { RawItem } from "@/services/connectors/types";

/**
 * AI pipeline on in-memory Postgres with a scripted model: classification, deep analysis,
 * trend discovery with evidence gates, experiment generation, the weekly report, and
 * clean stops on rate limits. Exercises the real gateway + structured-output path.
 */
process.env.PGLITE_DIR = "memory://";
process.env.AI_REQUESTS_PER_MINUTE = "60000"; // no pacing delay in tests
process.env.AI_DAILY_REQUEST_LIMIT = "1000";
delete process.env.DATABASE_URL;

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000);
const feeds: Record<string, RawItem[]> = { "lab-blog": [], community: [] };

vi.mock("@/services/connectors/catalog", () => {
  const fake = { id: "rss", fetch: async (def: { slug: string }) => feeds[def.slug] ?? [] };
  return {
    CONNECTORS: { rss: fake, arxiv: fake, hn: fake, github: fake, hf_papers: fake },
    SOURCE_CATALOG: [
      { slug: "lab-blog", name: "Lab Blog", kind: "blog", connector: "rss", url: "https://openai.com/news/rss.xml", homepage: "https://openai.com", credibility: 0.95 },
      { slug: "community", name: "Community", kind: "rss", connector: "rss", url: "https://arstechnica.com/ai/feed/", homepage: "https://arstechnica.com", credibility: 0.8 },
    ],
  };
});

const { closeDb, getDb } = await import("@/server/db/client");
const { runMigrations } = await import("@/server/db/migrate");
const { seedDemo, reduceToReference } = await import("@/server/db/seed");
const schema = await import("@/server/db/schema");
const { ingestAll } = await import("@/server/ingest/pipeline");
const { runEnrich } = await import("@/server/jobs/enrich");
const { runInsights } = await import("@/server/jobs/insights");
const { setProvidersForTesting } = await import("@/services/ai/registry");
const { RateLimitError } = await import("@/services/ai/types");
const { ai, requestsToday } = await import("@/server/ai/gateway");
const { logger } = await import("@/lib/logger");

const log = logger.child({ test: true });
const refsIn = (prompt: string, attr = "ref") => [...prompt.matchAll(new RegExp(`${attr}="([^"]+)"`, "g"))].map((m) => m[1]!);
const audiences = { students: "s", aiEngineers: "a", softwareEngineers: "se", researchers: "r", founders: "f", companies: "c" };

/** Scripted model: answers each task with JSON, like a real provider in JSON mode. */
class FakeLLM implements LLMProvider {
  readonly id = "fake";
  readonly isMock = false;
  readonly models = { fast: "fake-fast", strong: "fake-strong" };
  calls: string[] = [];
  failAfter = Infinity;
  dropRef: string | null = null;

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    this.calls.push(req.task);
    if (this.calls.length > this.failAfter) throw new RateLimitError("fake: rate limited");
    const prompt = req.messages.map((m) => m.content).join("\n");
    return { text: JSON.stringify(this.answer(req.task, prompt)), model: this.models[req.tier], inputTokens: 100, outputTokens: 50 };
  }
  generateObject<T>(_req: GenerateRequest, _schema: ZodType<T>): Promise<T> {
    throw new Error("the gateway must route structured calls through generate()");
  }
  async *stream(): AsyncIterable<string> {
    yield "ok";
  }

  private answer(task: string, prompt: string): unknown {
    if (task === "classify") {
      return {
        items: refsIn(prompt)
          .filter((ref) => ref !== this.dropRef)
          .map((ref) => {
            const big = prompt.split(`ref="${ref}"`)[1]?.split("</item>")[0]?.includes("agent") ?? false;
            return {
              ref,
              category: "agents",
              tldr: "A grounded one-sentence summary.",
              whyItMatters: "It changes how teams build.",
              tags: ["Agents", "tooling"],
              impact: big ? 92 : 40,
              novelty: big ? 85 : 35,
              technical: big ? 88 : 30,
              industry: big ? 90 : 40,
              career: big ? 90 : 35,
              clickbait: 0,
            };
          }),
      };
    }
    if (task === "analyze") {
      return {
        technical: "How it works, from the excerpt.",
        beginner: "A simple explanation.",
        audiences,
        action: { action: "Read it", experiment: "Try it", timeEstimate: "2 hours", careerRelevance: "high" },
        claims: [
          { text: "Stated in the excerpt.", label: "fact", confidence: "high" },
          { text: "This may spread.", label: "speculation", confidence: "low" },
        ],
      };
    }
    if (task === "discover-trends") {
      const refs = refsIn(prompt);
      const bySource = (name: string) => refs.filter((r) => prompt.includes(`ref="${r}" source="${name}"`));
      return {
        trends: [
          {
            title: "Agent tooling consolidates around shared protocols",
            thesis: "Agent tooling is moving from bespoke integrations to shared protocols across vendors.",
            summary: "Several independent items describe agent tooling converging on shared protocols and common harness patterns.",
            whyHappening: "Integration cost grows with every tool and model pairing.",
            chain: ["Tool sprawl", "Shared protocols", "Portable agents"],
            skills: ["Agent Engineering"],
            affectedRoles: ["ai-engineer"],
            evidenceRefs: [...bySource("Lab Blog").slice(0, 2), ...bySource("Community").slice(0, 2), "s999"],
            implications: [
              { text: "Unsupported fact.", label: "fact", confidence: "high", evidenceRefs: [] },
              { text: "Supported fact.", label: "fact", confidence: "high", evidenceRefs: [refs[0]] },
            ],
          },
          {
            // Only one outlet supports this → must be rejected by the evidence gate.
            title: "Single outlet hype cycle about robots",
            thesis: "One outlet repeatedly says the same thing about robots and nothing else supports it.",
            summary: "This proposed trend is supported by a single source and should not survive validation at all.",
            whyHappening: "Because one outlet said so repeatedly.",
            chain: ["A", "B", "C"],
            skills: [],
            affectedRoles: [],
            evidenceRefs: bySource("Lab Blog").slice(0, 3),
            implications: [],
          },
        ],
      };
    }
    if (task === "experiment") {
      return {
        title: "Benchmark two agent harnesses on a small task set",
        summary: "Compare two open agent harnesses on ten tasks and report success rates.",
        whyInteresting: "Shows how much the harness matters.",
        skills: ["Agent Engineering", "AI Evaluation"],
        technologies: ["Python"],
        difficulty: "intermediate",
        timeEstimate: "1 weekend",
        architecture: "A task manifest, a runner per harness, and a results table with pass or fail.",
        dataRequirements: "Ten small tasks.",
        expectedResult: "A comparison table.",
        githubPotential: 4,
        resumeValue: 4,
        startupPotential: 2,
        steps: ["Collect", "Run", "Score", "Write up"].map((t) => ({ title: t, detail: `${t} the tasks carefully.` })),
      };
    }
    if (task === "career-impact") {
      return {
        impacts: [
          { role: "ai-engineer", headline: "Tool design becomes part of the job", exposure: 60, automated: ["Glue code"], augmented: ["Design"], newSkills: ["Protocols"], decliningSkills: [], newRoles: [], tools: [], studentAdvice: "Build one integration end to end.", confidence: "low" },
        ],
      };
    }
    if (task === "briefing-overview") {
      const refs = refsIn(prompt);
      return {
        bullets: [
          { text: "Agent tooling dominated the period across sources.", label: "fact", refs: refs.slice(0, 2) },
          { text: "An unsupported factual sentence without refs.", label: "fact", refs: ["s404"] },
        ],
      };
    }
    throw new Error(`unscripted task ${task}`);
  }
}

const fake = new FakeLLM();

function story(i: number, source: "lab-blog" | "community", topic: string): RawItem {
  const host = source === "lab-blog" ? "openai.com/index" : "arstechnica.com/ai";
  return {
    externalId: `${source}-${i}`,
    kind: "article",
    title: `${topic} update number ${i} from ${source} with details`,
    url: `https://${host}/${topic.replace(/\s+/g, "-")}-${i}`,
    publishedAt: hoursAgo(2 + i),
    summary: `This excerpt describes ${topic} number ${i} in enough detail to ground a summary and a longer analysis of what changed and why.`,
  };
}

beforeAll(async () => {
  await runMigrations();
  await seedDemo(getDb(), new Date());
  await reduceToReference(getDb());
  feeds["lab-blog"] = Array.from({ length: 10 }, (_, i) => story(i, "lab-blog", i < 5 ? "agent protocol" : "chip supply"));
  feeds.community = Array.from({ length: 9 }, (_, i) => story(i, "community", i < 5 ? "agent harness" : "office news"));
  feeds.community.push({ externalId: "no-excerpt", kind: "article", title: "A headline about agent news with no excerpt at all", url: "https://arstechnica.com/ai/no-excerpt", publishedAt: hoursAgo(1) });
  await ingestAll(log);
  setProvidersForTesting({ llm: fake });
});
afterAll(async () => {
  setProvidersForTesting();
  await closeDb();
});

describe("enrichment", () => {
  it("pauses cleanly when the provider rate-limits and resumes on the next run", async () => {
    fake.failAfter = 1; // first classification batch succeeds, the second is rate limited
    const first = await runEnrich(log, { budgetMs: 20_000 });
    expect(first.classified).toBe(8);
    expect(String(first.stopped)).toMatch(/rate limited/);
    expect(first.pendingClassification).toBe(12);

    fake.failAfter = Infinity;
    fake.dropRef = "i2"; // the model forgets one item in a batch
    const second = await runEnrich(log, { budgetMs: 20_000 });
    expect(second.classified).toBe(10);
    expect(second.classifyFailed).toBe(2); // one dropped ref in each of the two batches
    expect(second.pendingClassification).toBe(0);
    expect(second.stopped).toBeUndefined();
    fake.dropRef = null;
  });

  it("stores model scores, grounded summaries and cited analysis", async () => {
    const rows = await getDb().select().from(schema.items);
    const enriched = rows.filter((r) => r.status === "enriched");
    expect(enriched.length).toBe(18);
    expect(rows.filter((r) => r.status === "enrich_failed")).toHaveLength(2);
    expect(enriched.every((r) => r.scoreBreakdown?.method === "llm")).toBe(true);
    expect(enriched.every((r) => r.tags.every((t) => t === t.toLowerCase()))).toBe(true);

    const agentStory = enriched.find((r) => r.title.includes("agent protocol"))!;
    expect(agentStory.score).toBeGreaterThanOrEqual(80);
    expect(agentStory.tldr).toBe("A grounded one-sentence summary.");
    expect(agentStory.analysis?.kind).toBe("article");
    // Facts cite the item itself; speculation cites nothing.
    expect(agentStory.analysis!.claims[0]).toMatchObject({ label: "fact", sourceItemIds: [agentStory.id] });
    expect(agentStory.analysis!.claims[1]).toMatchObject({ label: "speculation", sourceItemIds: [] });

    const routine = enriched.find((r) => r.title.includes("office news"))!;
    expect(routine.score).toBeLessThan(65);
    expect(routine.analysis).toBeNull(); // below the deep-analysis threshold

    // No excerpt → the model's summary is discarded and no analysis is attempted.
    const bare = rows.find((r) => r.title.includes("no excerpt"))!;
    expect(bare.tldr).toBeNull();
    expect(bare.analysis).toBeNull();
  });

  it("meters every real model call", async () => {
    const usage = await getDb().select().from(schema.aiUsage);
    expect(usage.filter((u) => u.task === "classify").length).toBeGreaterThanOrEqual(3);
    expect(usage.some((u) => u.task === "analyze" && u.model === "fake-strong")).toBe(true);
    expect(await requestsToday()).toBeGreaterThan(0);
  });
});

describe("insights", () => {
  it("creates only corroborated trends, plus experiments, role analysis and a weekly report", async () => {
    const before = (await getDb().select().from(schema.trends)).length;
    const stats = await runInsights(log);
    expect(stats.trendsDiscovered).toBe(1);
    expect(stats.experimentsGenerated).toBeGreaterThanOrEqual(1);
    expect(stats.weekly).toBe("stored");

    const all = await getDb().select().from(schema.trends);
    expect(all.length).toBe(before + 1);
    const trend = all.find((t) => t.slug === "agent-tooling-consolidates-around-shared-protocols")!;
    expect(trend).toMatchObject({ isDemo: false, status: "emerging" });
    // The unsupported "fact" was downgraded; the supported one kept its citation.
    expect(trend.implications[0]).toMatchObject({ label: "analysis", confidence: "low", sourceItemIds: [] });
    expect(trend.implications[1]!.label).toBe("fact");
    expect(trend.implications[1]!.sourceItemIds).toHaveLength(1);
    const evidence = await getDb().select().from(schema.trendItems).where(eq(schema.trendItems.trendId, trend.id));
    expect(evidence).toHaveLength(4); // the hallucinated ref "s999" was dropped
    expect(all.some((t) => t.title.includes("Single outlet"))).toBe(false);

    const generated = (await getDb().select().from(schema.experiments)).filter((e) => !e.isDemo);
    expect(generated[0]!.sourceItemIds).toHaveLength(1);

    const [weekly] = await getDb().select().from(schema.briefings).where(eq(schema.briefings.kind, "weekly"));
    expect(weekly!.content.title).toBe("The State of AI — This Week");
    expect(weekly!.content.overview![0]).toMatchObject({ label: "fact" });
    expect(weekly!.content.overview![0]!.sourceItemIds.length).toBeGreaterThan(0);
    expect(weekly!.content.overview![1]).toMatchObject({ label: "analysis", sourceItemIds: [] });
  });

  it("does not rediscover trends on the next run", async () => {
    const stats = await runInsights(log);
    expect(stats.trendsDiscovered).toBe(0);
  });
});

describe("gateway", () => {
  it("routes structured calls through the metered generate path", async () => {
    const before = fake.calls.length;
    const { z } = await import("zod");
    await expect(ai({ interactive: true }).llm.generateObject({ tier: "fast", task: "career-impact", messages: [{ role: "user", content: "x" }] }, z.object({ impacts: z.array(z.unknown()) }))).resolves.toBeTruthy();
    expect(fake.calls.length).toBe(before + 1);
  });
});
