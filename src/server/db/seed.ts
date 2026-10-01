import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Briefing, Claim, ItemAnalysis } from "@/domain/analysis";
import { validateClaims } from "@/domain/citations";
import { DEMO_USER_ID } from "@/domain/constants";
import { computeScore } from "@/domain/scoring";
import { classifySkillMomentum } from "@/domain/skills";
import { hashEmbed } from "@/services/mock/embeddings";
import { seedBriefing } from "@/services/mock/seed-data/briefing";
import { seedCareerImpacts, seedSkillProfiles } from "@/services/mock/seed-data/career";
import { seedEntities, seedRelations } from "@/services/mock/seed-data/entities";
import { seedExperiments } from "@/services/mock/seed-data/experiments";
import { seedItems } from "@/services/mock/seed-data/items";
import { seedSources } from "@/services/mock/seed-data/sources";
import { seedStartups } from "@/services/mock/seed-data/startups";
import { seedTrends } from "@/services/mock/seed-data/trends";
import type { Database } from "./client";
import * as s from "./schema";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Deterministic pseudo-random in [0,1) so seeded series are stable across runs. */
function seeded(seed: string) {
  let h = Number.parseInt(sha256(seed).slice(0, 8), 16);
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return (h % 10_000) / 10_000;
  };
}

function resolver(map: Map<string, string>, kind: string) {
  return (key: string): string => {
    const v = map.get(key);
    if (!v) throw new Error(`Seed data references unknown ${kind} "${key}"`);
    return v;
  };
}

/** Truncates all content + user tables. Better Auth users other than the demo user are preserved. */
export async function clearContent(db: Database) {
  await db.execute(sql`
    TRUNCATE TABLE
      briefings, startup_profiles, experiments, career_impacts, skill_status, skill_signals,
      trend_snapshots, trend_entities, trend_items, trends, entity_relations, item_entities,
      item_metric_snapshots, items, story_clusters, entities, sources
    CASCADE`);
}

export async function isSeeded(db: Database): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(s.items);
  return (rows[0]?.n ?? 0) > 0;
}

export async function seedDemo(db: Database, now: Date = new Date()) {
  // Demo viewer (cannot sign in — no credential account).
  await db
    .insert(s.user)
    .values({ id: DEMO_USER_ID, name: "Demo Explorer", email: "demo@ai-pulse.local", emailVerified: true })
    .onConflictDoNothing();
  await db
    .insert(s.userPreferences)
    .values({ userId: DEMO_USER_ID, interests: ["ai-agents", "llms", "software-engineering", "career", "research"], roles: ["ai-engineer"] })
    .onConflictDoNothing();

  // Sources
  const sourceIds = new Map<string, string>();
  const sourceCred = new Map<string, number>();
  for (const src of seedSources) {
    const id = crypto.randomUUID();
    sourceIds.set(src.slug, id);
    sourceCred.set(src.slug, src.credibility);
  }
  await db.insert(s.sources).values(
    seedSources.map((src) => ({ id: sourceIds.get(src.slug)!, ...src, isDemo: true, lastFetchedAt: now })),
  );
  const sourceId = resolver(sourceIds, "source");

  // Entities + relations
  const entityIds = new Map(seedEntities.map((e) => [e.key, crypto.randomUUID()]));
  const entityId = resolver(entityIds, "entity");
  await db.insert(s.entities).values(
    seedEntities.map((e) => ({
      id: entityId(e.key),
      type: e.type,
      slug: e.key,
      name: e.name,
      description: e.description,
      url: e.url ?? null,
      aliases: e.aliases ?? [],
      // Entities are real-world reference data (companies, models, skills), kept when demo content is purged.
      isDemo: false,
    })),
  );
  await db.insert(s.entityRelations).values(
    seedRelations.map((r) => ({
      sourceEntityId: entityId(r.from),
      targetEntityId: entityId(r.to),
      relation: r.relation,
      weight: r.weight ?? 1,
    })),
  );

  // Items
  const itemIds = new Map(seedItems.map((i) => [i.key, crypto.randomUUID()]));
  const itemId = resolver(itemIds, "item");
  const mapClaims = (claims: Claim[]): Claim[] => claims.map((c) => ({ ...c, sourceItemIds: c.sourceItemIds.map(itemId) }));
  const mapAnalysis = (a: ItemAnalysis | undefined): ItemAnalysis | null => (a ? { ...a, claims: mapClaims(a.claims) } : null);

  const clusterRows: (typeof s.storyClusters.$inferInsert)[] = [];
  const itemRows: (typeof s.items.$inferInsert)[] = [];
  for (const it of seedItems) {
    const publishedAt = new Date(now.getTime() - it.hoursAgo * HOUR);
    const breakdown = computeScore({
      sub: it.sub,
      sourceCredibility: sourceCred.get(it.source) ?? 0.5,
      corroboratingSources: it.corroboration,
      momentum: it.momentum,
      publishedAt,
      now,
      method: "demo",
    });
    const clusterId = crypto.randomUUID();
    clusterRows.push({ id: clusterId, title: it.title, leadItemId: itemId(it.key), sourceCount: it.corroboration, itemCount: it.corroboration, firstSeenAt: publishedAt });
    itemRows.push({
      id: itemId(it.key),
      kind: it.kind,
      title: it.title,
      url: it.url,
      urlHash: sha256(it.url),
      sourceId: sourceId(it.source),
      author: it.author ?? null,
      publishedAt,
      fetchedAt: publishedAt,
      snippet: it.snippet,
      contentHash: sha256(`${it.title}\n${it.snippet}`),
      category: it.category,
      tags: it.tags,
      tldr: it.tldr,
      whyItMatters: it.whyItMatters,
      analysis: mapAnalysis(it.analysis),
      score: breakdown.score,
      scoreBreakdown: breakdown,
      confidence: it.confidence ?? (it.corroboration >= 2 ? "high" : "medium"),
      clusterId,
      embedding: hashEmbed([it.title, it.tldr, it.snippet, it.tags.join(" ")].join("\n")),
      metrics: it.metrics ?? {},
      status: "enriched",
      isDemo: true,
    });
  }
  await db.insert(s.storyClusters).values(clusterRows);
  await db.insert(s.items).values(itemRows);

  await db.insert(s.itemEntities).values(
    seedItems.flatMap((it) =>
      it.entities.map((ek, idx) => ({ itemId: itemId(it.key), entityId: entityId(ek), salience: Math.max(0.3, 1 - idx * 0.1) })),
    ),
  );

  // Star-history snapshots for repositories (DEMO): linear back-fill from current stars.
  const snapshots: (typeof s.itemMetricSnapshots.$inferInsert)[] = [];
  for (const it of seedItems.filter((i) => i.kind === "repo" && i.metrics?.stars)) {
    const rnd = seeded(it.key);
    const perDay = (it.metrics!.starsDelta7d ?? 0) / 7;
    for (let d = 14; d >= 0; d--) {
      snapshots.push({
        itemId: itemId(it.key),
        capturedAt: new Date(now.getTime() - d * DAY),
        metrics: { stars: Math.round(it.metrics!.stars! - perDay * d * (0.85 + rnd() * 0.3)) },
      });
    }
  }
  if (snapshots.length) await db.insert(s.itemMetricSnapshots).values(snapshots);

  // Trends
  const trendIds = new Map(seedTrends.map((t) => [t.slug, crypto.randomUUID()]));
  const trendId = resolver(trendIds, "trend");
  await db.insert(s.trends).values(
    seedTrends.map((t) => ({
      id: trendId(t.slug),
      slug: t.slug,
      title: t.title,
      thesis: t.thesis,
      summary: t.summary,
      status: t.status,
      momentum: t.momentum,
      whyHappening: t.whyHappening,
      implications: mapClaims(t.implications),
      affectedRoles: t.affectedRoles,
      skills: t.skills,
      chain: t.chain,
      firstSeenAt: new Date(now.getTime() - t.firstSeenDaysAgo * DAY),
      updatedAt: now,
      isDemo: true,
    })),
  );
  await db.insert(s.trendItems).values(
    seedTrends.flatMap((t) => t.items.map((ik, idx) => ({ trendId: trendId(t.slug), itemId: itemId(ik), relevance: Math.max(0.4, 1 - idx * 0.06) }))),
  );
  await db.insert(s.trendEntities).values(
    seedTrends.flatMap((t) => t.entities.map((ek) => ({ trendId: trendId(t.slug), entityId: entityId(ek) }))),
  );
  const trendSnaps: (typeof s.trendSnapshots.$inferInsert)[] = [];
  for (const t of seedTrends) {
    const rnd = seeded(t.slug);
    for (let d = 89; d >= 0; d--) {
      const progress = (89 - d) / 89;
      const eased = progress * progress * (3 - 2 * progress);
      const mentions = Math.max(0, Math.round(t.curve.start + (t.curve.end - t.curve.start) * eased + (rnd() - 0.5) * 2 * t.curve.noise));
      trendSnaps.push({ trendId: trendId(t.slug), date: isoDate(new Date(now.getTime() - d * DAY)), mentionCount: mentions, score: mentions * (1 + t.momentum) });
    }
  }
  await db.insert(s.trendSnapshots).values(trendSnaps);

  // Skills: synthetic daily signals → deterministic status classification.
  const signalRows: (typeof s.skillSignals.$inferInsert)[] = [];
  const statusRows: (typeof s.skillStatus.$inferInsert)[] = [];
  for (const [skillKey, profile] of Object.entries(seedSkillProfiles)) {
    const rnd = seeded(skillKey);
    const sid = entityId(skillKey);
    for (let d = 59; d >= 0; d--) {
      const window = d >= 30 ? profile.prev30 : profile.last30;
      const daily = Math.max(0, Math.round((window / 30) * (0.7 + rnd() * 0.6)));
      signalRows.push({ skillId: sid, date: isoDate(new Date(now.getTime() - d * DAY)), mentions: daily, repoMentions: Math.round(daily * 0.3), jobMentions: Math.round(daily * 0.2) });
    }
    const { status, growth } = classifySkillMomentum(profile.last30, profile.prev30);
    const evidence = seedItems.filter((i) => i.entities.includes(skillKey)).map((i) => itemId(i.key));
    statusRows.push({ skillId: sid, status, growth30d: growth, last30: profile.last30, prev30: profile.prev30, evidenceItemIds: evidence, updatedAt: now });
  }
  await db.insert(s.skillSignals).values(signalRows);
  await db.insert(s.skillStatus).values(statusRows);

  // Career impacts
  await db.insert(s.careerImpacts).values(
    seedCareerImpacts.map((c) => ({
      role: c.role,
      trendId: c.trend ? trendId(c.trend) : null,
      headline: c.headline,
      exposure: c.exposure,
      automated: c.automated,
      augmented: c.augmented,
      newSkills: c.newSkills,
      decliningSkills: c.decliningSkills,
      newRoles: c.newRoles,
      tools: c.tools,
      studentAdvice: c.studentAdvice,
      confidence: c.confidence,
      sourceItemIds: c.sourceItems.map(itemId),
      isDemo: true,
    })),
  );

  // Experiments
  await db.insert(s.experiments).values(
    seedExperiments.map((e) => ({
      slug: e.slug,
      title: e.title,
      summary: e.summary,
      whyInteresting: e.whyInteresting,
      skills: e.skills,
      technologies: e.technologies,
      difficulty: e.difficulty,
      timeEstimate: e.timeEstimate,
      architecture: e.architecture,
      dataRequirements: e.dataRequirements,
      expectedResult: e.expectedResult,
      githubPotential: e.githubPotential,
      resumeValue: e.resumeValue,
      startupPotential: e.startupPotential,
      steps: e.steps,
      sourceItemIds: e.sourceItems.map(itemId),
      trendId: e.trend ? trendId(e.trend) : null,
      createdAt: new Date(now.getTime() - e.daysAgo * DAY),
      isDemo: true,
    })),
  );

  // Startups
  await db.insert(s.startupProfiles).values(
    seedStartups.map((st) => ({
      entityId: entityId(st.entity),
      tagline: st.tagline,
      problem: st.problem,
      product: st.product,
      aiTech: st.aiTech,
      fundingStage: st.fundingStage,
      investors: st.investors,
      founders: st.founders,
      market: st.market,
      competitors: st.competitors,
      interesting: st.interesting,
      weaknesses: st.weaknesses,
      ideas: st.ideas,
      verifiedFields: st.verifiedFields,
      sourceItemIds: st.sourceItems.map(itemId),
      momentum: st.momentum,
      updatedAt: now,
    })),
  );

  // Daily briefing
  const b = seedBriefing;
  const bullets = (list: Briefing["jobs"]) => list.map((x) => ({ ...x, sourceItemIds: x.sourceItemIds.map(itemId) }));
  const content: Briefing = {
    ...b,
    headline: { ...b.headline, itemId: itemId(b.headline.itemId) },
    topStoryIds: b.topStoryIds.map(itemId),
    researchItemId: b.researchItemId && itemId(b.researchItemId),
    toolItemId: b.toolItemId && itemId(b.toolItemId),
    repoItemId: b.repoItemId && itemId(b.repoItemId),
    jobs: bullets(b.jobs),
    payAttention: bullets(b.payAttention),
  };
  await db.insert(s.briefings).values({ kind: "daily", date: isoDate(now), content, model: "demo-seed", generatedAt: now, isDemo: true });

  return {
    sources: seedSources.length,
    entities: seedEntities.length,
    items: seedItems.length,
    trends: seedTrends.length,
    experiments: seedExperiments.length,
    startups: seedStartups.length,
  };
}

/**
 * Production seed mode: keep only curated reference data (entities, relations, trend theses,
 * experiments, startup profiles, role analyses) and remove everything simulated — demo news
 * items, demo sources, the demo briefing, synthetic trend/skill time series and any citation
 * of demo items. Facts left without a source are downgraded by the citation validator.
 */
export async function reduceToReference(db: Database, now: Date = new Date()) {
  await db.delete(s.items).where(eq(s.items.isDemo, true));
  await db.delete(s.sources).where(eq(s.sources.isDemo, true));
  await db.delete(s.briefings).where(eq(s.briefings.isDemo, true));
  await db.execute(sql`delete from story_clusters c where not exists (select 1 from items i where i.cluster_id = c.id)`);
  await db.delete(s.trendSnapshots);
  await db.delete(s.skillSignals);
  await db.update(s.skillStatus).set({ status: "insufficient", growth30d: null, last30: 0, prev30: 0, evidenceItemIds: [], updatedAt: now });
  await db.update(s.careerImpacts).set({ sourceItemIds: [], confidence: "low" });
  await db.update(s.experiments).set({ sourceItemIds: [] });
  await db.update(s.startupProfiles).set({ sourceItemIds: [], verifiedFields: [] });
  const trendRows = await db.select({ id: s.trends.id, implications: s.trends.implications }).from(s.trends);
  for (const t of trendRows) {
    await db
      .update(s.trends)
      .set({ implications: validateClaims(t.implications, new Set()), firstSeenAt: now, updatedAt: now })
      .where(eq(s.trends.id, t.id));
  }
}
