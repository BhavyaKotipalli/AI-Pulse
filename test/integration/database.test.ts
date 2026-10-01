import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * End-to-end check of the data layer on an ephemeral in-memory Postgres (PGlite + pgvector):
 * migrations apply, the demo dataset seeds with all cross-references resolved, and the
 * repositories (ranking, hybrid search, retrieval, bookmarks) behave as the UI expects.
 */
process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { closeDb, getDb } = await import("@/server/db/client");
const { runMigrations } = await import("@/server/db/migrate");
const { seedDemo } = await import("@/server/db/seed");
const schema = await import("@/server/db/schema");
const items = await import("@/server/repositories/items");
const search = await import("@/server/repositories/search");
const intel = await import("@/server/repositories/intel");
const userData = await import("@/server/repositories/user-data");
const qa = await import("@/server/qa/answer");
const { DEMO_USER_ID } = await import("@/domain/constants");

beforeAll(async () => {
  await runMigrations();
  await seedDemo(getDb(), new Date());
});

afterAll(async () => {
  await closeDb();
});

describe("demo dataset", () => {
  it("ranks the viral clickbait post at the bottom despite top momentum", async () => {
    const all = await items.listItems({ limit: 100 });
    const bait = all.find((i) => i.title.includes("replace ALL programmers"));
    expect(bait).toBeDefined();
    expect(bait!.score).toBeLessThan(30);
    expect(all.at(-1)!.id).toBe(bait!.id);
  });

  it("produces a briefing whose references all resolve", async () => {
    const briefing = await intel.getLatestBriefing();
    expect(briefing).not.toBeNull();
    const resolved = await intel.hydrateBriefing(briefing!.content);
    expect(resolved.has(briefing!.content.headline.itemId)).toBe(true);
    for (const id of briefing!.content.topStoryIds) expect(resolved.has(id)).toBe(true);
  });

  it("derives skill status from evidence", async () => {
    const radar = await intel.skillRadar();
    const mcp = radar.find((s) => s.slug === "mcp-skill");
    const manual = radar.find((s) => s.slug === "manual-prompt-tuning");
    expect(mcp?.status.status).toBe("exploding");
    expect(manual?.status.status).toBe("declining");
    expect(mcp?.series.length).toBeGreaterThan(4);
  });
});

describe("hybrid search", () => {
  it("finds coding-agent intelligence for a natural-language query", async () => {
    const hits = await search.hybridSearchItems("coding agents that run tests", { limit: 5 });
    expect(hits.some((h) => h.title.includes("coding agents"))).toBe(true);
  });

  it("matches exact identifiers via full-text search", async () => {
    const hits = await search.hybridSearchItems("PagedAttention", { limit: 3 });
    expect(hits[0]?.title).toContain("PagedAttention");
    expect(hits[0]?.textMatch).toBe(true);
  });

  it("finds related items by embedding", async () => {
    const [mcp] = await search.hybridSearchItems("Model Context Protocol", { limit: 1 });
    const related = await items.relatedItems(mcp!.id, { limit: 3 });
    expect(related).toHaveLength(3);
    expect(related.some((r) => r.id === mcp!.id)).toBe(false);
  });
});

describe("Ask AI retrieval", () => {
  it("returns no sources for off-topic questions (so the answer says it doesn't know)", async () => {
    expect(await qa.retrieveSources("best sourdough pizza dough hydration", [])).toHaveLength(0);
  });

  it("answers 'what happened today' from top-ranked recent items", async () => {
    const sources = await qa.retrieveSources("What happened in AI today?", []);
    expect(sources.length).toBeGreaterThan(2);
    expect(sources.every((s) => !s.title.includes("replace ALL programmers"))).toBe(true);
  });

  it("pins the item being asked about as source [1]", async () => {
    const [paper] = await items.listItems({ kinds: ["paper"], limit: 1 });
    const sources = await qa.retrieveSources("Explain this like I'm a beginner", [], paper!.id);
    expect(sources[0]).toMatchObject({ index: 1, itemId: paper!.id });
  });
});

describe("bookmarks", () => {
  it("adds, reads and removes per collection idempotently", async () => {
    const [item] = await items.listItems({ limit: 1 });
    await userData.addBookmark(DEMO_USER_ID, "item", item!.id, "research");
    await userData.addBookmark(DEMO_USER_ID, "item", item!.id, "research"); // idempotent
    const state = await userData.bookmarkState(DEMO_USER_ID, "item", [item!.id]);
    expect(state.get(item!.id)).toEqual(["research"]);
    await userData.removeBookmark(DEMO_USER_ID, "item", item!.id, "research");
    const rows = await getDb().select().from(schema.bookmarks).where(eq(schema.bookmarks.targetId, item!.id));
    expect(rows).toHaveLength(0);
  });
});
