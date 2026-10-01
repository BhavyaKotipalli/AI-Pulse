import { createHash } from "node:crypto";
import { eq, gte, inArray, sql } from "drizzle-orm";
import { buildEntityMatcher } from "@/domain/entity-matcher";
import { categorize, heuristicSubScores, inferKind } from "@/domain/heuristics";
import { canonicalUrl, cleanTitle, DUPLICATE_TITLE_THRESHOLD, firstSentence, jaccard, makeSnippet, titleTokens } from "@/domain/normalize";
import type { ItemMetrics } from "@/domain/analysis";
import { computeScore, rescore, type ScoreBreakdown } from "@/domain/scoring";
import type { EntityType } from "@/domain/taxonomy";
import type { logger as Logger } from "@/lib/logger";
import { getDb } from "@/server/db/client";
import {
  entities,
  itemEntities,
  itemMetricSnapshots,
  items,
  skillSignals,
  sources,
  storyClusters,
  trendEntities,
  trendItems,
} from "@/server/db/schema";
import { getEmbedder } from "@/services/ai/registry";
import { CONNECTORS, SOURCE_CATALOG } from "@/services/connectors/catalog";
import type { RawItem, SourceDefinition } from "@/services/connectors/types";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

interface SourceStats {
  fetched: number;
  inserted: number;
  duplicates: number;
  updated: number;
  clustered: number;
  rejected: number;
  error?: string;
}

interface RunContext {
  match: (text: string) => string[];
  entityType: Map<string, EntityType>;
  trendEntityMap: Map<string, Set<string>>; // trendId → entityIds
  recent: Array<{ clusterId: string; tokens: Set<string>; sourceId: string | null }>;
  embed: (texts: string[]) => Promise<number[][]>;
}

/** Upserts the live source catalog into `sources` and returns slug → row. */
async function syncSources() {
  const db = getDb();
  for (const s of SOURCE_CATALOG) {
    await db
      .insert(sources)
      .values({ slug: s.slug, name: s.name, kind: s.kind, url: s.url, homepage: s.homepage, credibility: s.credibility, isDemo: false })
      .onConflictDoUpdate({ target: sources.slug, set: { name: s.name, url: s.url, homepage: s.homepage, credibility: s.credibility } });
  }
  const rows = await db.select().from(sources).where(inArray(sources.slug, SOURCE_CATALOG.map((s) => s.slug)));
  return new Map(rows.map((r) => [r.slug, r]));
}

async function buildContext(): Promise<RunContext> {
  const db = getDb();
  const [ents, te, recent] = await Promise.all([
    db.select({ id: entities.id, name: entities.name, aliases: entities.aliases, type: entities.type }).from(entities),
    db.select().from(trendEntities),
    db
      .select({ clusterId: items.clusterId, title: items.title, sourceId: items.sourceId })
      .from(items)
      .where(gte(items.publishedAt, new Date(Date.now() - 72 * 3_600_000))),
  ]);
  const trendEntityMap = new Map<string, Set<string>>();
  for (const r of te) trendEntityMap.set(r.trendId, (trendEntityMap.get(r.trendId) ?? new Set()).add(r.entityId));
  const embedder = getEmbedder();
  return {
    match: buildEntityMatcher(ents),
    entityType: new Map(ents.map((e) => [e.id, e.type])),
    trendEntityMap,
    recent: recent.filter((r) => r.clusterId).map((r) => ({ clusterId: r.clusterId!, tokens: titleTokens(r.title), sourceId: r.sourceId })),
    embed: (texts) => embedder.embed(texts),
  };
}

/** Finds an existing story cluster for a title (same story covered by another outlet). */
function findCluster(ctx: RunContext, tokens: Set<string>): RunContext["recent"][number] | undefined {
  let best: RunContext["recent"][number] | undefined;
  let bestScore = DUPLICATE_TITLE_THRESHOLD;
  for (const r of ctx.recent) {
    const s = jaccard(tokens, r.tokens);
    if (s >= bestScore) {
      best = r;
      bestScore = s;
    }
  }
  return best;
}

type ExistingItem = {
  id: string;
  kind: string;
  sourceId: string | null;
  clusterId: string | null;
  metrics: ItemMetrics;
  scoreBreakdown: ScoreBreakdown | null;
  publishedAt: Date;
};

/**
 * Another source returned a URL we already have. Merge fresh metrics (stars, HN points),
 * and count the source as corroboration exactly once (tracked in `metrics.seenIn`), then
 * recompute the score with the higher momentum and corroboration.
 */
async function updateExisting(existing: ExistingItem, raw: RawItem, def: SourceDefinition, sourceRow: { id: string }, stats: SourceStats) {
  const db = getDb();
  const seenIn = existing.metrics.seenIn ?? [];
  const isNewCorroboration = existing.sourceId !== sourceRow.id && !seenIn.includes(def.slug);
  if (!raw.metrics && !isNewCorroboration) {
    stats.duplicates++;
    return;
  }
  const metrics: ItemMetrics = { ...existing.metrics, ...(raw.metrics ?? {}), seenIn: isNewCorroboration ? [...seenIn, def.slug] : seenIn };
  // Keep identity fields from the original source.
  if (existing.kind === "paper") metrics.authors = existing.metrics.authors ?? raw.metrics?.authors;

  let sourceCount = 1;
  if (existing.clusterId) {
    const [c] = await db
      .update(storyClusters)
      .set({ sourceCount: isNewCorroboration ? sql`${storyClusters.sourceCount} + 1` : storyClusters.sourceCount })
      .where(eq(storyClusters.id, existing.clusterId))
      .returning({ sourceCount: storyClusters.sourceCount });
    sourceCount = c?.sourceCount ?? 1;
  }
  const update: Partial<typeof items.$inferInsert> = { metrics };
  if (existing.scoreBreakdown) {
    const b = existing.scoreBreakdown;
    const momentum = Math.max(b.dimensions.momentum, raw.momentum ?? 0);
    const next = rescore({ ...b, dimensions: { ...b.dimensions, momentum } }, existing.publishedAt, sourceCount);
    update.score = next.score;
    update.scoreBreakdown = next;
    if (sourceCount >= 2) update.confidence = "high";
  }
  await db.update(items).set(update).where(eq(items.id, existing.id));
  if (existing.kind === "repo" && raw.metrics) await db.insert(itemMetricSnapshots).values({ itemId: existing.id, metrics: raw.metrics });
  stats.updated++;
}

async function ingestRaw(raws: RawItem[], def: SourceDefinition, sourceRow: { id: string; credibility: number }, ctx: RunContext, stats: SourceStats) {
  const db = getDb();
  type Prepared = { raw: RawItem; url: string; urlHash: string; title: string; snippet: string | null };
  const prepared: Prepared[] = [];
  for (const raw of raws) {
    try {
      const url = canonicalUrl(raw.url);
      const title = cleanTitle(raw.title);
      if (title.length < 6) throw new Error("title too short");
      if (def.filter && !def.filter.test(`${title} ${raw.summary ?? ""}`)) {
        stats.rejected++;
        continue;
      }
      prepared.push({ raw: { ...raw, kind: inferKind(title, raw.kind) }, url, urlHash: sha256(url), title, snippet: makeSnippet(raw.summary) });
    } catch {
      stats.rejected++;
    }
  }
  if (prepared.length === 0) return;

  const existing = await db
    .select({
      id: items.id,
      urlHash: items.urlHash,
      kind: items.kind,
      sourceId: items.sourceId,
      clusterId: items.clusterId,
      metrics: items.metrics,
      scoreBreakdown: items.scoreBreakdown,
      publishedAt: items.publishedAt,
    })
    .from(items)
    .where(inArray(items.urlHash, prepared.map((p) => p.urlHash)));
  const existingByHash = new Map(existing.map((e) => [e.urlHash, e]));
  const fresh: Prepared[] = [];
  const seenInBatch = new Set<string>();
  for (const p of prepared) {
    const ex = existingByHash.get(p.urlHash);
    if (ex) await updateExisting(ex, p.raw, def, sourceRow, stats);
    else if (!seenInBatch.has(p.urlHash)) {
      seenInBatch.add(p.urlHash);
      fresh.push(p);
    } else stats.duplicates++;
  }
  if (fresh.length === 0) return;

  const vectors = await ctx.embed(fresh.map((p) => [p.title, p.snippet ?? "", (p.raw.tags ?? []).join(" ")].join("\n")));

  for (const [i, p] of fresh.entries()) {
    const text = `${p.title} ${p.snippet ?? ""} ${(p.raw.tags ?? []).join(" ")}`;
    const entityIds = ctx.match(text);
    const skillIds = entityIds.filter((id) => ctx.entityType.get(id) === "skill");
    const tokens = titleTokens(p.title);

    // Story clustering: join an existing cluster when another outlet covered the same story.
    const match = findCluster(ctx, tokens);
    let clusterId: string;
    let sourceCount = 1;
    if (match) {
      clusterId = match.clusterId;
      const newSource = match.sourceId !== sourceRow.id;
      const [c] = await db
        .update(storyClusters)
        .set({ itemCount: sql`${storyClusters.itemCount} + 1`, sourceCount: newSource ? sql`${storyClusters.sourceCount} + 1` : storyClusters.sourceCount })
        .where(eq(storyClusters.id, clusterId))
        .returning({ sourceCount: storyClusters.sourceCount });
      sourceCount = c?.sourceCount ?? 1;
      stats.clustered++;
    } else {
      const [c] = await db.insert(storyClusters).values({ title: p.title, firstSeenAt: p.raw.publishedAt }).returning({ id: storyClusters.id });
      clusterId = c!.id;
    }

    const sub = heuristicSubScores({
      kind: p.raw.kind,
      title: p.title,
      snippet: p.snippet,
      entityCount: entityIds.length - skillIds.length,
      skillCount: skillIds.length,
      sourceCredibility: sourceRow.credibility,
    });
    const breakdown = computeScore({
      sub,
      sourceCredibility: sourceRow.credibility,
      corroboratingSources: sourceCount,
      momentum: p.raw.momentum ?? Math.min(100, 20 + (sourceCount - 1) * 20),
      publishedAt: p.raw.publishedAt,
      method: "heuristic",
    });

    const [inserted] = await db
      .insert(items)
      .values({
        kind: p.raw.kind,
        title: p.title,
        url: p.url,
        urlHash: p.urlHash,
        sourceId: sourceRow.id,
        author: p.raw.author ?? null,
        publishedAt: p.raw.publishedAt,
        snippet: p.snippet,
        contentHash: sha256(`${p.title}\n${p.snippet ?? ""}`),
        category: categorize(text, p.raw.kind),
        tags: (p.raw.tags ?? []).map((t) => t.toLowerCase()).slice(0, 8),
        tldr: firstSentence(p.snippet),
        score: breakdown.score,
        scoreBreakdown: breakdown,
        confidence: sourceCount >= 2 ? "high" : "medium",
        clusterId,
        embedding: vectors[i],
        metrics: p.raw.metrics ?? {},
        status: "normalized",
        isDemo: false,
      })
      .onConflictDoNothing()
      .returning({ id: items.id });
    if (!inserted) {
      stats.duplicates++;
      continue;
    }
    stats.inserted++;
    ctx.recent.push({ clusterId, tokens, sourceId: sourceRow.id });
    if (!match) await db.update(storyClusters).set({ leadItemId: inserted.id }).where(eq(storyClusters.id, clusterId));

    if (entityIds.length) {
      await db
        .insert(itemEntities)
        .values(entityIds.map((entityId, idx) => ({ itemId: inserted.id, entityId, salience: Math.max(0.3, 1 - idx * 0.1) })))
        .onConflictDoNothing();
    }
    // Trend evidence: link when the item shares ≥ 2 entities with a trend.
    const entitySet = new Set(entityIds);
    for (const [trendId, trendSet] of ctx.trendEntityMap) {
      const overlap = [...trendSet].filter((e) => entitySet.has(e)).length;
      if (overlap >= 2) {
        await db.insert(trendItems).values({ trendId, itemId: inserted.id, relevance: Math.min(1, overlap / 4) }).onConflictDoNothing();
      }
    }
    // Skill evidence counts (drive the career radar).
    for (const skillId of skillIds) {
      await db
        .insert(skillSignals)
        .values({ skillId, date: today(), mentions: 1, repoMentions: p.raw.kind === "repo" ? 1 : 0 })
        .onConflictDoUpdate({
          target: [skillSignals.skillId, skillSignals.date],
          set: { mentions: sql`${skillSignals.mentions} + 1`, repoMentions: sql`${skillSignals.repoMentions} + ${p.raw.kind === "repo" ? 1 : 0}` },
        });
    }
    if (p.raw.kind === "repo" && p.raw.metrics) await db.insert(itemMetricSnapshots).values({ itemId: inserted.id, metrics: p.raw.metrics });
  }
}

const DEFAULT_LOOKBACK_HOURS = 72;

/** Fetches every catalog source (isolated failures), normalizes, dedupes, enriches and stores. */
export async function ingestAll(log: typeof Logger, opts: { only?: string[]; lookbackHours?: number; githubToken?: string } = {}) {
  const db = getDb();
  const sourceRows = await syncSources();
  const ctx = await buildContext();
  const defs = SOURCE_CATALOG.filter((s) => !opts.only || opts.only.includes(s.slug));
  const results: Record<string, SourceStats> = {};

  const runOne = async (def: SourceDefinition) => {
    const stats: SourceStats = { fetched: 0, inserted: 0, duplicates: 0, updated: 0, clustered: 0, rejected: 0 };
    results[def.slug] = stats;
    const row = sourceRows.get(def.slug)!;
    const since = new Date(Date.now() - (opts.lookbackHours ?? DEFAULT_LOOKBACK_HOURS) * 3_600_000);
    try {
      const raws = await CONNECTORS[def.connector].fetch(def, { since, githubToken: opts.githubToken });
      stats.fetched = raws.length;
      await ingestRaw(raws, def, row, ctx, stats);
      await db.update(sources).set({ lastFetchedAt: new Date() }).where(eq(sources.id, row.id));
    } catch (err) {
      stats.error = err instanceof Error ? err.message : String(err);
      log.warn({ source: def.slug, err: stats.error }, "source failed");
    }
  };

  // Feeds in small parallel batches; API connectors one at a time (rate limits).
  const feeds = defs.filter((d) => d.connector === "rss");
  for (let i = 0; i < feeds.length; i += 4) await Promise.all(feeds.slice(i, i + 4).map(runOne));
  for (const def of defs.filter((d) => d.connector !== "rss")) await runOne(def);

  const totals = Object.values(results).reduce(
    (t, s) => ({ fetched: t.fetched + s.fetched, inserted: t.inserted + s.inserted, updated: t.updated + s.updated, failedSources: t.failedSources + (s.error ? 1 : 0) }),
    { fetched: 0, inserted: 0, updated: 0, failedSources: 0 },
  );
  return { ...totals, sources: results };
}

/** Number of live (ingested, non-demo) items. */
export async function liveItemCount(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.isDemo, false));
  return row?.n ?? 0;
}
