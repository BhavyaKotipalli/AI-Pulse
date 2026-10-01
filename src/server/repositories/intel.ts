import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Briefing } from "@/domain/analysis";
import type { Role } from "@/domain/taxonomy";
import { getDb } from "@/server/db/client";
import {
  briefings,
  careerImpacts,
  entities,
  entityRelations,
  experiments,
  skillSignals,
  skillStatus,
  startupProfiles,
  trendEntities,
  trendItems,
  trendSnapshots,
  trends,
} from "@/server/db/schema";
import { getItemsByIds, type EntityRef } from "./items";

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

// ─── Trends ────────────────────────────────────────────────────────────────

export type TrendRow = typeof trends.$inferSelect;
export interface TrendSummary extends TrendRow {
  series: number[];
  evidenceCount: number;
  change30d: number | null;
}

async function seriesFor(trendIds: string[], days: number) {
  if (trendIds.length === 0) return new Map<string, Array<{ date: string; mentions: number }>>();
  const rows = await getDb()
    .select({ trendId: trendSnapshots.trendId, date: trendSnapshots.date, mentions: trendSnapshots.mentionCount })
    .from(trendSnapshots)
    .where(and(inArray(trendSnapshots.trendId, trendIds), gte(trendSnapshots.date, daysAgoIso(days - 1))))
    .orderBy(asc(trendSnapshots.date));
  const map = new Map<string, Array<{ date: string; mentions: number }>>();
  for (const r of rows) map.set(r.trendId, [...(map.get(r.trendId) ?? []), { date: r.date, mentions: r.mentions }]);
  return map;
}

/** Percent change of mentions: last 30 days vs the 30 before. */
function change30(points: Array<{ mentions: number }>): number | null {
  if (points.length < 60) return null;
  const sum = (arr: Array<{ mentions: number }>) => arr.reduce((s, p) => s + p.mentions, 0);
  const last = sum(points.slice(-30));
  const prev = sum(points.slice(-60, -30));
  return prev === 0 ? null : Math.round(((last - prev) / prev) * 100);
}

export async function listTrends(limit = 20): Promise<TrendSummary[]> {
  const db = getDb();
  const rows = await db.select().from(trends).orderBy(desc(trends.momentum)).limit(limit);
  const ids = rows.map((r) => r.id);
  const [series, counts] = await Promise.all([
    seriesFor(ids, 60),
    ids.length
      ? db
          .select({ trendId: trendItems.trendId, n: sql<number>`count(*)::int` })
          .from(trendItems)
          .where(inArray(trendItems.trendId, ids))
          .groupBy(trendItems.trendId)
      : Promise.resolve([]),
  ]);
  const countMap = new Map(counts.map((c) => [c.trendId, c.n]));
  return rows.map((r) => {
    const pts = series.get(r.id) ?? [];
    return { ...r, series: pts.slice(-30).map((p) => p.mentions), evidenceCount: countMap.get(r.id) ?? 0, change30d: change30(pts) };
  });
}

export async function getTrend(slug: string) {
  const db = getDb();
  const [trend] = await db.select().from(trends).where(eq(trends.slug, slug)).limit(1);
  if (!trend) return null;
  const [evidence, ents, series, impacts, exps] = await Promise.all([
    db.select({ itemId: trendItems.itemId }).from(trendItems).where(eq(trendItems.trendId, trend.id)).orderBy(desc(trendItems.relevance)),
    db
      .select({ id: entities.id, slug: entities.slug, name: entities.name, type: entities.type })
      .from(trendEntities)
      .innerJoin(entities, eq(trendEntities.entityId, entities.id))
      .where(eq(trendEntities.trendId, trend.id)),
    seriesFor([trend.id], 90),
    db.select().from(careerImpacts).where(eq(careerImpacts.trendId, trend.id)),
    db.select().from(experiments).where(eq(experiments.trendId, trend.id)),
  ]);
  const items = await getItemsByIds(evidence.map((e) => e.itemId));
  const points = series.get(trend.id) ?? [];
  return { trend, items, entities: ents as EntityRef[], series: points, impacts, experiments: exps };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}
export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

/** Knowledge-graph neighbourhood for a set of entities (1 hop). */
export async function entityGraph(entityIds: string[]): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  if (entityIds.length === 0) return { nodes: [], edges: [] };
  const db = getDb();
  const rels = await db
    .select()
    .from(entityRelations)
    .where(sql`${entityRelations.sourceEntityId} in ${entityIds} or ${entityRelations.targetEntityId} in ${entityIds}`);
  const nodeIds = new Set(entityIds);
  for (const r of rels) {
    nodeIds.add(r.sourceEntityId);
    nodeIds.add(r.targetEntityId);
  }
  const nodes = await db
    .select({ id: entities.id, label: entities.name, type: entities.type })
    .from(entities)
    .where(inArray(entities.id, [...nodeIds]));
  return {
    nodes,
    edges: rels.map((r) => ({ source: r.sourceEntityId, target: r.targetEntityId, relation: r.relation })),
  };
}

// ─── Experiments ───────────────────────────────────────────────────────────

export type ExperimentRow = typeof experiments.$inferSelect;

export async function listExperiments(limit = 30): Promise<ExperimentRow[]> {
  return getDb().select().from(experiments).orderBy(desc(experiments.createdAt), desc(experiments.resumeValue)).limit(limit);
}

export async function getExperiment(slug: string) {
  const [exp] = await getDb().select().from(experiments).where(eq(experiments.slug, slug)).limit(1);
  if (!exp) return null;
  const sources = await getItemsByIds(exp.sourceItemIds);
  const trend = exp.trendId
    ? (await getDb().select({ slug: trends.slug, title: trends.title }).from(trends).where(eq(trends.id, exp.trendId)).limit(1))[0] ?? null
    : null;
  return { experiment: exp, sources, trend };
}

/** Experiments generated from (or citing) a given item. */
export async function experimentsForItem(itemId: string): Promise<ExperimentRow[]> {
  return getDb()
    .select()
    .from(experiments)
    .where(sql`${itemId} = any(${experiments.sourceItemIds})`)
    .limit(4);
}

export async function getExperimentsByIds(ids: string[]): Promise<ExperimentRow[]> {
  if (ids.length === 0) return [];
  return getDb().select().from(experiments).where(inArray(experiments.id, ids));
}

// ─── Startups ──────────────────────────────────────────────────────────────

const startupColumns = {
  slug: entities.slug,
  name: entities.name,
  description: entities.description,
  url: entities.url,
  isDemo: entities.isDemo,
  profile: startupProfiles,
};

export async function listStartups(limit = 30) {
  return getDb()
    .select(startupColumns)
    .from(startupProfiles)
    .innerJoin(entities, eq(startupProfiles.entityId, entities.id))
    .orderBy(desc(startupProfiles.momentum))
    .limit(limit);
}
export type StartupRow = Awaited<ReturnType<typeof listStartups>>[number];

export async function getStartup(slug: string) {
  const [row] = await getDb()
    .select(startupColumns)
    .from(startupProfiles)
    .innerJoin(entities, eq(startupProfiles.entityId, entities.id))
    .where(and(eq(entities.slug, slug), eq(entities.type, "startup")))
    .limit(1);
  if (!row) return null;
  const sources = await getItemsByIds(row.profile.sourceItemIds);
  return { ...row, sources };
}

// ─── Career ────────────────────────────────────────────────────────────────

export type CareerImpactRow = typeof careerImpacts.$inferSelect;

export async function listCareerImpacts(role?: Role): Promise<CareerImpactRow[]> {
  return getDb()
    .select()
    .from(careerImpacts)
    .where(role ? eq(careerImpacts.role, role) : undefined)
    .orderBy(desc(careerImpacts.exposure));
}

export async function skillRadar() {
  const db = getDb();
  const rows = await db
    .select({ id: entities.id, slug: entities.slug, name: entities.name, description: entities.description, status: skillStatus })
    .from(skillStatus)
    .innerJoin(entities, eq(skillStatus.skillId, entities.id))
    .orderBy(desc(skillStatus.growth30d));
  const signals = await db
    .select({ skillId: skillSignals.skillId, mentions: skillSignals.mentions })
    .from(skillSignals)
    .where(gte(skillSignals.date, daysAgoIso(59)))
    .orderBy(asc(skillSignals.date));
  // Weekly buckets for a smooth sparkline.
  const weekly = new Map<string, number[]>();
  const daily = new Map<string, number[]>();
  for (const s of signals) daily.set(s.skillId, [...(daily.get(s.skillId) ?? []), s.mentions]);
  for (const [id, values] of daily) {
    const buckets: number[] = [];
    for (let i = 0; i < values.length; i += 7) buckets.push(values.slice(i, i + 7).reduce((a, b) => a + b, 0));
    weekly.set(id, buckets);
  }
  return rows.map((r) => ({ ...r, series: weekly.get(r.id) ?? [] }));
}
export type SkillRadarRow = Awaited<ReturnType<typeof skillRadar>>[number];

// ─── Briefings ─────────────────────────────────────────────────────────────

export async function getLatestBriefing(kind: "daily" | "weekly" = "daily") {
  const [row] = await getDb().select().from(briefings).where(eq(briefings.kind, kind)).orderBy(desc(briefings.date)).limit(1);
  return row ?? null;
}

/** Resolves every item reference inside a briefing in one query. */
export async function hydrateBriefing(content: Briefing) {
  const ids = new Set<string>([content.headline.itemId, ...content.topStoryIds]);
  for (const id of [content.researchItemId, content.toolItemId, content.repoItemId]) if (id) ids.add(id);
  for (const b of [...content.jobs, ...content.payAttention]) b.sourceItemIds.forEach((id) => ids.add(id));
  const list = await getItemsByIds([...ids]);
  return new Map(list.map((i) => [i.id, i]));
}
