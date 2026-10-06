import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { composeBriefing } from "@/domain/briefing";
import { rescore } from "@/domain/scoring";
import { classifySkillMomentum } from "@/domain/skills";
import type { logger as Logger } from "@/lib/logger";
import { ai } from "@/server/ai/gateway";
import { addOverview } from "./insights";
import { getDb } from "@/server/db/client";
import {
  briefings,
  entities,
  experiments,
  itemEntities,
  items,
  skillSignals,
  skillStatus,
  startupProfiles,
  storyClusters,
  trendItems,
  trendSnapshots,
  trends,
} from "@/server/db/schema";

const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Refreshes recency and corroboration for recent items so rankings decay over time. */
async function rescoreRecent(now: Date) {
  const db = getDb();
  const rows = await db
    .select({ id: items.id, publishedAt: items.publishedAt, breakdown: items.scoreBreakdown, sourceCount: storyClusters.sourceCount, score: items.score })
    .from(items)
    .leftJoin(storyClusters, eq(items.clusterId, storyClusters.id))
    .where(gte(items.publishedAt, new Date(now.getTime() - 30 * DAY)));
  let changed = 0;
  for (const r of rows) {
    if (!r.breakdown) continue;
    const next = rescore(r.breakdown, r.publishedAt, r.sourceCount ?? 1, now);
    if (next.score !== r.score) {
      await db.update(items).set({ score: next.score, scoreBreakdown: next }).where(eq(items.id, r.id));
      changed++;
    }
  }
  return { rescored: rows.length, changed };
}

/** Recomputes each skill's momentum from the last 60 days of evidence. */
async function recomputeSkills(now: Date) {
  const db = getDb();
  const cutoffLast = isoDate(new Date(now.getTime() - 29 * DAY));
  const cutoffPrev = isoDate(new Date(now.getTime() - 59 * DAY));
  const sums = await db
    .select({
      skillId: skillSignals.skillId,
      last30: sql<number>`coalesce(sum(case when ${skillSignals.date} >= ${cutoffLast} then ${skillSignals.mentions} else 0 end), 0)::int`,
      prev30: sql<number>`coalesce(sum(case when ${skillSignals.date} < ${cutoffLast} then ${skillSignals.mentions} else 0 end), 0)::int`,
    })
    .from(skillSignals)
    .where(gte(skillSignals.date, cutoffPrev))
    .groupBy(skillSignals.skillId);
  for (const s of sums) {
    const { status, growth } = classifySkillMomentum(s.last30, s.prev30);
    const evidence = await db
      .select({ id: items.id })
      .from(itemEntities)
      .innerJoin(items, eq(itemEntities.itemId, items.id))
      .where(and(eq(itemEntities.entityId, s.skillId), gte(items.publishedAt, new Date(now.getTime() - 30 * DAY))))
      .orderBy(desc(items.score))
      .limit(20);
    const values = { status, growth30d: growth, last30: s.last30, prev30: s.prev30, evidenceItemIds: evidence.map((e) => e.id), updatedAt: now };
    await db.insert(skillStatus).values({ skillId: s.skillId, ...values }).onConflictDoUpdate({ target: skillStatus.skillId, set: values });
  }
  return { skills: sums.length };
}

/** Builds and stores today's deterministic briefing from the top-ranked recent items. */
export async function buildDailyBriefing(now: Date, log: typeof Logger) {
  const db = getDb();
  let windowHours = 24;
  let candidates = await recentCandidates(now, windowHours);
  if (candidates.filter((c) => c.kind === "article" || c.kind === "launch").length < 6) {
    windowHours = 72;
    candidates = await recentCandidates(now, windowHours);
  }

  const [trendRows, evidenceRows, latestExperiment, topStartup, skillRows] = await Promise.all([
    db.select().from(trends),
    db.select({ trendId: trendItems.trendId, itemId: trendItems.itemId }).from(trendItems).orderBy(desc(trendItems.relevance)),
    db.select({ slug: experiments.slug }).from(experiments).orderBy(desc(experiments.createdAt)).limit(1),
    db.select({ slug: entities.slug }).from(startupProfiles).innerJoin(entities, eq(startupProfiles.entityId, entities.id)).orderBy(desc(startupProfiles.momentum)).limit(1),
    db.select({ name: entities.name, status: skillStatus }).from(skillStatus).innerJoin(entities, eq(skillStatus.skillId, entities.id)).orderBy(desc(skillStatus.growth30d)),
  ]);
  const evidence = new Map<string, string[]>();
  for (const e of evidenceRows) evidence.set(e.trendId, [...(evidence.get(e.trendId) ?? []), e.itemId]);

  const composed = composeBriefing({
    items: candidates,
    totalItemsConsidered: candidates.length,
    trends: trendRows.map((t) => ({ slug: t.slug, title: t.title, thesis: t.thesis, status: t.status, momentum: t.momentum, evidenceItemIds: evidence.get(t.id) ?? [] })),
    experimentSlug: latestExperiment[0]?.slug,
    startupSlug: topStartup[0]?.slug,
    skills: skillRows.map((s) => ({ name: s.name, status: s.status.status, growth: s.status.growth30d, evidenceItemIds: s.status.evidenceItemIds })),
    hourUtc: now.getUTCHours(),
  });
  if (!composed) return { briefing: "skipped", reason: "no stories in window" };
  const gw = ai();
  let content = composed;
  try {
    content = await addOverview(gw, composed, "today", log);
  } catch (err) {
    // Quota exhausted: the deterministic briefing is still complete and fully cited.
    log.info({ reason: err instanceof Error ? err.message : String(err) }, "briefing overview skipped");
  }

  const isDemo = candidates.every((c) => c.isDemo);
  const model = content.overview ? `${gw.llm.models.strong} + deterministic-v1` : "deterministic-v1";
  const values = { kind: "daily" as const, date: isoDate(now), content, model, generatedAt: now, isDemo };
  await db
    .insert(briefings)
    .values(values)
    .onConflictDoUpdate({ target: [briefings.kind, briefings.date], set: { content, model: values.model, generatedAt: now, isDemo } });
  return { briefing: "stored", windowHours, candidates: candidates.length };
}

async function recentCandidates(now: Date, hours: number) {
  const rows = await getDb()
    .select({
      id: items.id,
      kind: items.kind,
      title: items.title,
      tldr: items.tldr,
      whyItMatters: items.whyItMatters,
      category: items.category,
      score: items.score,
      metrics: items.metrics,
      isDemo: items.isDemo,
    })
    .from(items)
    .where(and(gte(items.publishedAt, new Date(now.getTime() - hours * 3_600_000)), gte(items.score, 40)))
    .orderBy(desc(items.score))
    .limit(150);
  return rows.map((r) => ({ ...r, starsDelta7d: r.metrics.starsDelta7d }));
}

/** Records today's live evidence volume per trend (feeds sparklines and 30-day change). */
async function snapshotTrends(now: Date) {
  const db = getDb();
  const counts = await db
    .select({ trendId: trendItems.trendId, n: sql<number>`count(*)::int` })
    .from(trendItems)
    .innerJoin(items, eq(trendItems.itemId, items.id))
    .where(gte(items.fetchedAt, new Date(now.getTime() - DAY)))
    .groupBy(trendItems.trendId);
  for (const c of counts) {
    await db
      .insert(trendSnapshots)
      .values({ trendId: c.trendId, date: isoDate(now), mentionCount: c.n, score: c.n })
      .onConflictDoUpdate({
        target: [trendSnapshots.trendId, trendSnapshots.date],
        set: { mentionCount: sql`greatest(${trendSnapshots.mentionCount}, ${c.n})`, score: sql`greatest(${trendSnapshots.score}, ${c.n})` },
      });
  }
  return { trendSnapshots: counts.length };
}

export async function runDaily(log: typeof Logger, now: Date = new Date()) {
  const scores = await rescoreRecent(now);
  log.info(scores, "rescored");
  const skills = await recomputeSkills(now);
  log.info(skills, "skills recomputed");
  const snaps = await snapshotTrends(now);
  const briefing = await buildDailyBriefing(now, log);
  log.info(briefing, "briefing");
  return { ...scores, ...skills, ...snaps, ...briefing };
}

/** Deletes seeded demo content (items, sources, trends, experiments, career, briefings). Entities are kept. */
export async function purgeDemo() {
  const db = getDb();
  const demoItems = await db.select({ id: items.id }).from(items).where(eq(items.isDemo, true));
  if (demoItems.length) await db.delete(items).where(inArray(items.id, demoItems.map((i) => i.id)));
  await db.execute(sql`delete from trends where is_demo = true`);
  await db.execute(sql`delete from experiments where is_demo = true`);
  await db.execute(sql`delete from career_impacts where is_demo = true`);
  await db.execute(sql`delete from briefings where is_demo = true`);
  await db.execute(sql`delete from sources where is_demo = true`);
  await db.execute(sql`delete from story_clusters c where not exists (select 1 from items i where i.cluster_id = c.id)`);
  return { removedItems: demoItems.length };
}
