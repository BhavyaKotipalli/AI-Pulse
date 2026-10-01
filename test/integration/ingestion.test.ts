import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { RawItem } from "@/services/connectors/types";

/**
 * Pipeline integration test on in-memory Postgres with a fake connector:
 * normalization, dedup, cross-source corroboration, entity/trend linking, idempotent
 * re-runs, job locking, the deterministic briefing, and the reference seed mode.
 */
process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000);
let feedA: RawItem[] = [];
let feedB: RawItem[] = [];

vi.mock("@/services/connectors/catalog", () => {
  const fake = { id: "rss", fetch: async (def: { slug: string }) => (def.slug === "fake-a" ? feedA : feedB) };
  return {
    CONNECTORS: { rss: fake, arxiv: fake, hn: fake, github: fake, hf_papers: fake },
    SOURCE_CATALOG: [
      { slug: "fake-a", name: "Lab Blog", kind: "blog", connector: "rss", url: "https://openai.com/news/rss.xml", homepage: "https://openai.com", credibility: 0.95 },
      { slug: "fake-b", name: "Community", kind: "hn", connector: "hn", url: "https://hn.algolia.com", homepage: "https://news.ycombinator.com", credibility: 0.6 },
    ],
  };
});

const { closeDb, getDb } = await import("@/server/db/client");
const { runMigrations } = await import("@/server/db/migrate");
const { seedDemo, reduceToReference } = await import("@/server/db/seed");
const schema = await import("@/server/db/schema");
const { ingestAll } = await import("@/server/ingest/pipeline");
const { runJob } = await import("@/server/jobs/runner");
const { runDaily } = await import("@/server/jobs/daily");
const { logger } = await import("@/lib/logger");

beforeAll(async () => {
  await runMigrations();
  await seedDemo(getDb(), new Date());
  await reduceToReference(getDb());
});
afterAll(() => closeDb());

const log = logger.child({ test: true });

describe("reference seed mode", () => {
  it("removes simulated news but keeps curated reference data", async () => {
    const db = getDb();
    expect(await db.select().from(schema.items)).toHaveLength(0);
    expect((await db.select().from(schema.trends)).length).toBeGreaterThan(0);
    expect((await db.select().from(schema.entities)).length).toBeGreaterThan(0);
    const trends = await db.select().from(schema.trends);
    for (const t of trends) for (const c of t.implications) expect(c.label === "fact" && c.sourceItemIds.length === 0).toBe(false);
  });
});

describe("ingestion pipeline", () => {
  it("normalizes, links entities and trends, and stores heuristic scores", async () => {
    feedA = [
      {
        externalId: "1",
        kind: "article",
        title: "Introducing new MCP support for coding agents in Claude Code",
        url: "https://openai.com/index/mcp-coding/?utm_source=rss",
        publishedAt: hoursAgo(2),
        summary: "<p>Coding agents can now use the Model Context Protocol to call tools. More details inside.</p>",
      },
      { externalId: "2", kind: "article", title: "Tiny", url: "https://openai.com/x", publishedAt: hoursAgo(1) }, // rejected: title too short
    ];
    feedB = [];
    const stats = await ingestAll(log, { only: ["fake-a"] });
    expect(stats.inserted).toBe(1);
    expect(stats.sources["fake-a"]!.rejected).toBe(1);

    const [item] = await getDb().select().from(schema.items);
    expect(item!.url).toBe("https://openai.com/index/mcp-coding"); // tracking param + trailing slash removed
    expect(item!.kind).toBe("launch"); // "Introducing …"
    expect(item!.snippet).not.toContain("<p>");
    expect(item!.scoreBreakdown?.method).toBe("heuristic");
    expect(item!.isDemo).toBe(false);

    const links = await getDb().select().from(schema.itemEntities).where(eq(schema.itemEntities.itemId, item!.id));
    expect(links.length).toBeGreaterThanOrEqual(3); // MCP, coding agents, Claude Code, …
    const trendLinks = await getDb().select().from(schema.trendItems).where(eq(schema.trendItems.itemId, item!.id));
    expect(trendLinks.length).toBeGreaterThan(0);
  });

  it("counts another source linking the same URL as corroboration exactly once", async () => {
    feedB = [
      {
        externalId: "hn1",
        kind: "article",
        title: "New MCP support for coding agents in Claude Code",
        url: "https://openai.com/index/mcp-coding",
        publishedAt: hoursAgo(1),
        metrics: { hnPoints: 900, hnComments: 300 },
        momentum: 90,
      },
    ];
    const before = (await getDb().select().from(schema.items))[0]!;
    await ingestAll(log, { only: ["fake-b"] });
    await ingestAll(log, { only: ["fake-b"] }); // re-run must not double count
    const [after] = await getDb().select().from(schema.items);
    const [cluster] = await getDb().select().from(schema.storyClusters).where(eq(schema.storyClusters.id, after!.clusterId!));
    expect(after!.metrics.hnPoints).toBe(900);
    expect(after!.metrics.seenIn).toEqual(["fake-b"]);
    expect(cluster!.sourceCount).toBe(2);
    expect(after!.score).toBeGreaterThan(before.score);
    expect(await getDb().select().from(schema.items)).toHaveLength(1);
  });

  it("clusters near-duplicate titles from different URLs", async () => {
    feedB = [
      {
        externalId: "hn2",
        kind: "article",
        title: "Introducing new MCP support for coding agents in Claude Code",
        url: "https://news.ycombinator.com/item?id=2",
        publishedAt: hoursAgo(1),
      },
    ];
    const stats = await ingestAll(log, { only: ["fake-b"] });
    expect(stats.sources["fake-b"]!.clustered).toBe(1);
    const rows = await getDb().select().from(schema.items);
    expect(new Set(rows.map((r) => r.clusterId)).size).toBe(1);
  });

  it("isolates source failures", async () => {
    feedA = null as unknown as RawItem[]; // connector returns garbage → error recorded, run continues
    const stats = await ingestAll(log);
    expect(stats.failedSources).toBe(1);
    expect(stats.sources["fake-a"]!.error).toBeTruthy();
  });
});

describe("jobs", () => {
  it("skips a job that is already running", async () => {
    let release!: () => void;
    const first = runJob("ingest", () => new Promise((r) => (release = () => r({}))));
    await new Promise((r) => setTimeout(r, 50));
    const second = await runJob("ingest", async () => ({}));
    expect(second.status).toBe("skipped");
    release();
    expect((await first).status).toBe("succeeded");
  });

  it("builds a live briefing from ingested items", async () => {
    feedA = Array.from({ length: 7 }, (_, i) => ({
      externalId: `s${i}`,
      kind: "article" as const,
      title: `Distinct headline number ${i} about ${["robots", "chips", "funding", "policy", "agents", "models", "evals"][i]}`,
      url: `https://openai.com/index/story-${i}`,
      publishedAt: hoursAgo(3 + i),
      summary: `Story ${i} summary sentence that is long enough to be used.`,
    }));
    await ingestAll(log, { only: ["fake-a"] });
    const result = await runDaily(log);
    expect(result.briefing).toBe("stored");
    const [b] = await getDb().select().from(schema.briefings);
    expect(b!.model).toBe("deterministic-v1");
    expect(b!.isDemo).toBe(false);
    expect(b!.content.topStoryIds.length).toBeGreaterThan(0);
  });
});
