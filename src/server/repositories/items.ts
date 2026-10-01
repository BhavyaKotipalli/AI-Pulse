import "server-only";
import { and, cosineDistance, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { ItemAnalysis, ItemMetrics } from "@/domain/analysis";
import type { ScoreBreakdown } from "@/domain/scoring";
import type { Category, Confidence, EntityType, ItemKind } from "@/domain/taxonomy";
import { getDb } from "@/server/db/client";
import { entities, itemEntities, itemMetricSnapshots, items, sources, storyClusters, trendItems, trends } from "@/server/db/schema";

export interface ItemSummary {
  id: string;
  kind: ItemKind;
  title: string;
  url: string;
  sourceName: string | null;
  sourceSlug: string | null;
  author: string | null;
  publishedAt: Date;
  tldr: string | null;
  whyItMatters: string | null;
  category: Category | null;
  tags: string[];
  score: number;
  scoreBreakdown: ScoreBreakdown | null;
  confidence: Confidence;
  metrics: ItemMetrics;
  sourceCount: number;
  isDemo: boolean;
}

const summaryColumns = {
  id: items.id,
  kind: items.kind,
  title: items.title,
  url: items.url,
  sourceName: sources.name,
  sourceSlug: sources.slug,
  author: items.author,
  publishedAt: items.publishedAt,
  tldr: items.tldr,
  whyItMatters: items.whyItMatters,
  category: items.category,
  tags: items.tags,
  score: items.score,
  scoreBreakdown: items.scoreBreakdown,
  confidence: items.confidence,
  metrics: items.metrics,
  sourceCount: sql<number>`coalesce(${storyClusters.sourceCount}, 1)`.mapWith(Number),
  isDemo: items.isDemo,
};

function baseSummaryQuery() {
  return getDb()
    .select(summaryColumns)
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .leftJoin(storyClusters, eq(items.clusterId, storyClusters.id));
}

export interface ListOptions {
  kinds?: ItemKind[];
  category?: Category;
  sinceHours?: number;
  limit?: number;
  sort?: "score" | "recent";
  minScore?: number;
}

export async function listItems(opts: ListOptions = {}): Promise<ItemSummary[]> {
  const where = and(
    opts.kinds?.length ? inArray(items.kind, opts.kinds) : undefined,
    opts.category ? eq(items.category, opts.category) : undefined,
    opts.sinceHours ? gte(items.publishedAt, new Date(Date.now() - opts.sinceHours * 3_600_000)) : undefined,
    opts.minScore !== undefined ? gte(items.score, opts.minScore) : undefined,
  );
  return baseSummaryQuery()
    .where(where)
    .orderBy(opts.sort === "recent" ? desc(items.publishedAt) : desc(items.score), desc(items.publishedAt))
    .limit(opts.limit ?? 20);
}

/** Fetches summaries by id, preserving the requested order. */
export async function getItemsByIds(ids: string[]): Promise<ItemSummary[]> {
  if (ids.length === 0) return [];
  const rows = await baseSummaryQuery().where(inArray(items.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is ItemSummary => Boolean(r));
}

export interface EntityRef {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
}

export interface ItemDetail extends ItemSummary {
  snippet: string | null;
  analysis: ItemAnalysis | null;
  sourceHomepage: string | null;
  entities: EntityRef[];
  trends: Array<{ slug: string; title: string }>;
}

export async function getItem(id: string): Promise<ItemDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({ ...summaryColumns, snippet: items.snippet, analysis: items.analysis, sourceHomepage: sources.homepage })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .leftJoin(storyClusters, eq(items.clusterId, storyClusters.id))
    .where(eq(items.id, id))
    .limit(1);
  if (!row) return null;

  const [ents, trs] = await Promise.all([
    db
      .select({ id: entities.id, slug: entities.slug, name: entities.name, type: entities.type })
      .from(itemEntities)
      .innerJoin(entities, eq(itemEntities.entityId, entities.id))
      .where(eq(itemEntities.itemId, id))
      .orderBy(desc(itemEntities.salience)),
    db
      .select({ slug: trends.slug, title: trends.title })
      .from(trendItems)
      .innerJoin(trends, eq(trendItems.trendId, trends.id))
      .where(eq(trendItems.itemId, id)),
  ]);
  return { ...row, entities: ents, trends: trs };
}

/** Nearest neighbours by embedding (cosine), optionally restricted by kind. */
export async function relatedItems(id: string, opts: { kinds?: ItemKind[]; limit?: number } = {}): Promise<ItemSummary[]> {
  const db = getDb();
  const [target] = await db.select({ embedding: items.embedding }).from(items).where(eq(items.id, id)).limit(1);
  if (!target?.embedding) return [];
  const distance = cosineDistance(items.embedding, target.embedding);
  return baseSummaryQuery()
    .where(and(ne(items.id, id), opts.kinds?.length ? inArray(items.kind, opts.kinds) : undefined))
    .orderBy(distance)
    .limit(opts.limit ?? 4);
}

export interface RepoWithHistory extends ItemSummary {
  history: number[];
}

export async function listTrendingRepos(limit = 10): Promise<RepoWithHistory[]> {
  const repos = await listItems({ kinds: ["repo"], limit: 50 });
  repos.sort((a, b) => (b.metrics.starsDelta7d ?? 0) - (a.metrics.starsDelta7d ?? 0));
  const top = repos.slice(0, limit);
  if (top.length === 0) return [];
  const snaps = await getDb()
    .select({ itemId: itemMetricSnapshots.itemId, metrics: itemMetricSnapshots.metrics })
    .from(itemMetricSnapshots)
    .where(inArray(itemMetricSnapshots.itemId, top.map((r) => r.id)))
    .orderBy(itemMetricSnapshots.capturedAt);
  const history = new Map<string, number[]>();
  for (const s of snaps) {
    const list = history.get(s.itemId) ?? [];
    if (typeof s.metrics.stars === "number") list.push(s.metrics.stars);
    history.set(s.itemId, list);
  }
  return top.map((r) => ({ ...r, history: history.get(r.id) ?? [] }));
}

export interface TimelineDay {
  date: string;
  items: ItemSummary[];
}

/** Highest-scoring items per day for the knowledge timeline. */
export async function timeline(days = 7, perDay = 3): Promise<TimelineDay[]> {
  const rows = await listItems({ sinceHours: days * 24, limit: 200, sort: "recent" });
  const byDay = new Map<string, ItemSummary[]>();
  for (const r of rows) {
    const key = r.publishedAt.toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), r]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, list]) => ({ date, items: list.sort((a, b) => b.score - a.score).slice(0, perDay) }));
}

/** Most-mentioned entities of a type over a window (analytics). */
export async function topEntities(type: EntityType, sinceHours = 24 * 7, limit = 8) {
  return getDb()
    .select({
      slug: entities.slug,
      name: entities.name,
      mentions: sql<number>`count(*)::int`,
      avgScore: sql<number>`round(avg(${items.score}))::int`,
    })
    .from(itemEntities)
    .innerJoin(entities, eq(itemEntities.entityId, entities.id))
    .innerJoin(items, eq(itemEntities.itemId, items.id))
    .where(and(eq(entities.type, type), gte(items.publishedAt, new Date(Date.now() - sinceHours * 3_600_000))))
    .groupBy(entities.slug, entities.name)
    .orderBy(desc(sql`count(*)`), desc(sql`avg(${items.score})`))
    .limit(limit);
}

/** Entity slugs per item, for personalization. */
export async function entitySlugsFor(ids: string[]): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ itemId: itemEntities.itemId, slug: entities.slug })
    .from(itemEntities)
    .innerJoin(entities, eq(itemEntities.entityId, entities.id))
    .where(inArray(itemEntities.itemId, ids));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r.slug]);
  return map;
}

export async function categoryCounts(sinceHours = 24 * 7) {
  return getDb()
    .select({ category: items.category, count: sql<number>`count(*)::int` })
    .from(items)
    .where(gte(items.publishedAt, new Date(Date.now() - sinceHours * 3_600_000)))
    .groupBy(items.category)
    .orderBy(desc(sql`count(*)`));
}
