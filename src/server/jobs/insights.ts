import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Briefing, Claim } from "@/domain/analysis";
import { composeBriefing } from "@/domain/briefing";
import { jaccard, titleTokens } from "@/domain/normalize";
import { CLAIM_LABELS, CONFIDENCE_LEVELS, DIFFICULTIES, ROLES } from "@/domain/taxonomy";
import type { logger as Logger } from "@/lib/logger";
import { ai, type Gateway } from "@/server/ai/gateway";
import { getDb } from "@/server/db/client";
import {
  briefings,
  careerImpacts,
  entities,
  experiments,
  itemEntities,
  items,
  skillStatus,
  sources,
  startupProfiles,
  trendEntities,
  trendItems,
  trendSnapshots,
  trends,
} from "@/server/db/schema";
import { BudgetExceededError, RateLimitError } from "@/services/ai/types";

const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const isQuotaStop = (err: unknown) => err instanceof RateLimitError || err instanceof BudgetExceededError;
const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

// ─── Trend momentum (deterministic) ────────────────────────────────────────

/**
 * Trend status and momentum from evidence, never asserted: compares live evidence added
 * in the last 7 days with the 7 days before. Trends with fewer than 5 linked items keep
 * their current values (not enough evidence to judge).
 */
export async function refreshTrendMomentum(now: Date) {
  const db = getDb();
  const rows = await db
    .select({
      trendId: trendItems.trendId,
      total: sql<number>`count(*)::int`,
      last7: sql<number>`count(*) filter (where ${items.publishedAt} >= ${new Date(now.getTime() - 7 * DAY)})::int`,
      prev7: sql<number>`count(*) filter (where ${items.publishedAt} < ${new Date(now.getTime() - 7 * DAY)} and ${items.publishedAt} >= ${new Date(now.getTime() - 14 * DAY)})::int`,
    })
    .from(trendItems)
    .innerJoin(items, eq(trendItems.itemId, items.id))
    .where(eq(items.isDemo, false))
    .groupBy(trendItems.trendId);
  let updated = 0;
  for (const r of rows) {
    if (r.total < 5) continue;
    const growth = (r.last7 + 1) / (r.prev7 + 1) - 1;
    const momentum = Math.max(-1, Math.min(1, growth / 2));
    const [t] = await db.select({ firstSeenAt: trends.firstSeenAt }).from(trends).where(eq(trends.id, r.trendId)).limit(1);
    const ageDays = t ? (now.getTime() - t.firstSeenAt.getTime()) / DAY : 99;
    const status = ageDays < 21 ? "emerging" : growth > 0.3 ? "accelerating" : growth < -0.3 ? "cooling" : "mainstream";
    await db.update(trends).set({ momentum, status, updatedAt: now }).where(eq(trends.id, r.trendId));
    updated++;
  }
  return { trendsRescored: updated };
}

// ─── Trend discovery (LLM) ─────────────────────────────────────────────────

const TrendDiscoverySchema = z.object({
  trends: z
    .array(
      z.object({
        title: z.string().min(8).max(90),
        thesis: z.string().min(20).max(260),
        summary: z.string().min(40).max(600),
        whyHappening: z.string().min(20).max(500),
        chain: z.array(z.string().max(50)).min(3).max(6),
        skills: z.array(z.string().max(50)).max(6),
        affectedRoles: z.array(z.enum(ROLES)).max(6),
        evidenceRefs: z.array(z.string()).min(3).max(12),
        implications: z
          .array(z.object({ text: z.string(), label: z.enum(CLAIM_LABELS), confidence: z.enum(CONFIDENCE_LEVELS), evidenceRefs: z.array(z.string()) }))
          .max(4),
      }),
    )
    .max(3),
});

const TREND_SYSTEM = `You are the trend analyst for AI Pulse. You receive recent AI/technology items (ref, source, title, summary) and the list of trends already tracked.
Identify up to 3 NEW macro trends: patterns supported by at least three different items, ideally from different sources. A trend is a direction of change ("X is moving from A to B"), not a single event or a product name.
Rules:
- Do not repeat or rephrase an existing trend. If nothing new is well supported, return an empty list - that is a good answer.
- evidenceRefs must list only refs you were given whose content genuinely supports the trend.
- chain: 3-6 short nodes showing how the effect propagates (cause -> ... -> consequence).
- implications: label "fact" only when directly supported by cited items; otherwise "analysis" or "speculation". Each lists its supporting refs (empty for speculation).
- No invented numbers, names or events.`;

export async function discoverTrends(gw: Gateway, now: Date, log: typeof Logger) {
  const db = getDb();
  const [recentlyCreated] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trends)
    .where(and(eq(trends.isDemo, false), gte(trends.firstSeenAt, new Date(now.getTime() - 3 * DAY))));
  if ((recentlyCreated?.n ?? 0) > 0) return { trendsDiscovered: 0, trendDiscovery: "skipped (ran within 3 days)" };

  const candidates = await db
    .select({ id: items.id, title: items.title, tldr: items.tldr, publishedAt: items.publishedAt, sourceId: items.sourceId, sourceName: sources.name })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .where(and(eq(items.isDemo, false), eq(items.status, "enriched"), gte(items.publishedAt, new Date(now.getTime() - 14 * DAY))))
    .orderBy(desc(items.score))
    .limit(60);
  if (candidates.length < 15) return { trendsDiscovered: 0, trendDiscovery: "skipped (fewer than 15 enriched items)" };

  const existing = await db.select({ title: trends.title, thesis: trends.thesis, slug: trends.slug }).from(trends);
  const refs = new Map(candidates.map((c, i) => [`s${i + 1}`, c]));
  const prompt = `<existing_trends>\n${existing.map((t) => `- ${t.title}: ${t.thesis}`).join("\n")}\n</existing_trends>\n\n<items>\n${[...refs.entries()]
    .map(([ref, c]) => `<item ref="${ref}" source="${c.sourceName ?? "unknown"}"><title>${c.title}</title><summary>${c.tldr ?? ""}</summary></item>`)
    .join("\n")}\n</items>`;

  const out = await gw.llm.generateObject(
    { tier: "strong", task: "discover-trends", system: TREND_SYSTEM, messages: [{ role: "user", content: prompt }], maxOutputTokens: 6000 },
    TrendDiscoverySchema,
  );

  let created = 0;
  for (const t of out.trends) {
    const evidence = [...new Set(t.evidenceRefs)].map((r) => refs.get(r)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    const distinctSources = new Set(evidence.map((e) => e.sourceId)).size;
    const slug = slugify(t.title);
    const tokens = titleTokens(t.title);
    const duplicate = existing.some((e) => e.slug === slug || jaccard(tokens, titleTokens(e.title)) >= 0.5);
    // Evidence gate: a trend needs corroboration, not a single outlet's framing.
    if (evidence.length < 3 || distinctSources < 2 || duplicate || !slug) {
      log.info({ title: t.title, evidence: evidence.length, distinctSources, duplicate }, "discarded proposed trend");
      continue;
    }
    const resolve = (list: string[]) => [...new Set(list)].map((r) => refs.get(r)?.id).filter((id): id is string => Boolean(id));
    const implications: Claim[] = t.implications.map((c) => {
      const sourceItemIds = resolve(c.evidenceRefs);
      const label = c.label === "fact" && sourceItemIds.length === 0 ? "analysis" : c.label;
      return { text: c.text, label, confidence: label === c.label ? c.confidence : "low", sourceItemIds };
    });
    const [row] = await db
      .insert(trends)
      .values({
        slug,
        title: t.title,
        thesis: t.thesis,
        summary: t.summary,
        status: "emerging",
        momentum: 0.3,
        whyHappening: t.whyHappening,
        implications,
        affectedRoles: t.affectedRoles,
        skills: t.skills,
        chain: t.chain,
        firstSeenAt: new Date(Math.min(...evidence.map((e) => e.publishedAt.getTime()))),
        updatedAt: now,
        isDemo: false,
      })
      .onConflictDoNothing()
      .returning({ id: trends.id });
    if (!row) continue;
    await db.insert(trendItems).values(evidence.map((e, i) => ({ trendId: row.id, itemId: e.id, relevance: Math.max(0.4, 1 - i * 0.06) })));
    const topEntities = await db
      .select({ entityId: itemEntities.entityId, n: sql<number>`count(*)::int` })
      .from(itemEntities)
      .where(inArray(itemEntities.itemId, evidence.map((e) => e.id)))
      .groupBy(itemEntities.entityId)
      .orderBy(desc(sql`count(*)`))
      .limit(8);
    if (topEntities.length) await db.insert(trendEntities).values(topEntities.map((e) => ({ trendId: row.id, entityId: e.entityId }))).onConflictDoNothing();
    await db.insert(trendSnapshots).values({ trendId: row.id, date: isoDate(now), mentionCount: evidence.length, score: evidence.length }).onConflictDoNothing();
    existing.push({ title: t.title, thesis: t.thesis, slug });
    created++;
  }
  return { trendsDiscovered: created };
}

// ─── Experiments (LLM) ─────────────────────────────────────────────────────

const ExperimentOut = z.object({
  title: z.string().min(10).max(110),
  summary: z.string().min(30).max(400),
  whyInteresting: z.string().min(20).max(400),
  skills: z.array(z.string().max(50)).min(2).max(6),
  technologies: z.array(z.string().max(80)).min(1).max(8),
  difficulty: z.enum(DIFFICULTIES),
  timeEstimate: z.string().max(40),
  architecture: z.string().min(30).max(700),
  dataRequirements: z.string().max(400),
  expectedResult: z.string().max(400),
  githubPotential: z.number().int().min(1).max(5),
  resumeValue: z.number().int().min(1).max(5),
  startupPotential: z.number().int().min(1).max(5),
  steps: z.array(z.object({ title: z.string().max(80), detail: z.string().max(400) })).min(4).max(8),
});

const EXPERIMENT_SYSTEM = `You design hands-on projects for AI Pulse's Experiment Lab. Given one recent development (title, summary, why it matters), design ONE buildable experiment a motivated developer could complete.
Rules:
- It must be genuinely buildable with public tools, free tiers or open models; name concrete technologies.
- Prefer experiments that produce a measurable result (a comparison, a benchmark, a working demo).
- Be honest about difficulty and time. Ratings are 1-5.
- Do not claim capabilities of the source development beyond what the summary states; if access to it is uncertain, design the experiment around an openly available alternative and say so.`;

export async function generateExperiments(gw: Gateway, now: Date, log: typeof Logger, max = 2) {
  const db = getDb();
  const [today] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(experiments)
    .where(and(eq(experiments.isDemo, false), gte(experiments.createdAt, new Date(now.getTime() - DAY))));
  if ((today?.n ?? 0) >= max) return { experimentsGenerated: 0 };

  const used = new Set((await db.select({ ids: experiments.sourceItemIds }).from(experiments)).flatMap((e) => e.ids));
  const candidates = await db
    .select({ id: items.id, kind: items.kind, title: items.title, tldr: items.tldr, why: items.whyItMatters })
    .from(items)
    .where(and(eq(items.isDemo, false), isNotNull(items.analysis), gte(items.score, 70), gte(items.publishedAt, new Date(now.getTime() - 7 * DAY))))
    .orderBy(desc(items.score))
    .limit(12);
  const linkedTrend = async (itemId: string) => (await db.select({ trendId: trendItems.trendId }).from(trendItems).where(eq(trendItems.itemId, itemId)).limit(1))[0]?.trendId ?? null;

  let created = 0;
  for (const c of candidates.filter((c) => !used.has(c.id)).slice(0, max - (today?.n ?? 0))) {
    try {
      const out = await gw.llm.generateObject(
        {
          tier: "strong",
          task: "experiment",
          system: EXPERIMENT_SYSTEM,
          messages: [{ role: "user", content: `<development kind="${c.kind}">\n<title>${c.title}</title>\n<summary>${c.tldr ?? ""}</summary>\n<why_it_matters>${c.why ?? ""}</why_it_matters>\n</development>` }],
          maxOutputTokens: 5000,
        },
        ExperimentOut,
      );
      await db
        .insert(experiments)
        .values({ ...out, slug: `${slugify(out.title)}-${c.id.slice(0, 6)}`, sourceItemIds: [c.id], trendId: await linkedTrend(c.id), createdAt: now, isDemo: false })
        .onConflictDoNothing();
      created++;
    } catch (err) {
      if (isQuotaStop(err)) throw err;
      log.warn({ err: msg(err), itemId: c.id }, "experiment generation failed");
    }
  }
  return { experimentsGenerated: created };
}

// ─── Career impact (LLM) ───────────────────────────────────────────────────

const CareerOut = z.object({
  impacts: z
    .array(
      z.object({
        role: z.enum(ROLES),
        headline: z.string().min(15).max(160),
        exposure: z.number().int().min(0).max(100),
        automated: z.array(z.string().max(90)).max(5),
        augmented: z.array(z.string().max(90)).max(5),
        newSkills: z.array(z.string().max(70)).max(5),
        decliningSkills: z.array(z.string().max(70)).max(4),
        newRoles: z.array(z.string().max(70)).max(3),
        tools: z.array(z.string().max(60)).max(5),
        studentAdvice: z.string().min(20).max(400),
        confidence: z.enum(CONFIDENCE_LEVELS),
      }),
    )
    .min(1)
    .max(3),
});

const CAREER_SYSTEM = `You analyze how an AI/technology trend changes jobs, for AI Pulse's Career Impact section.
Given a trend and its supporting items, describe the impact on the 1-3 most affected roles.
Rules:
- This is analysis, not fact: be measured. Do not predict mass job loss or cite statistics that are not in the evidence.
- "automated" = tasks increasingly done by AI; "augmented" = tasks humans do better with AI.
- exposure (0-100): how much the day-to-day work of the role is changing because of this trend.
- confidence: "low" unless the evidence directly discusses work or hiring effects.
- studentAdvice: concrete and actionable.`;

export async function generateCareerImpacts(gw: Gateway, log: typeof Logger) {
  const db = getDb();
  const covered = new Set(
    (await db.select({ trendId: careerImpacts.trendId }).from(careerImpacts).where(eq(careerImpacts.isDemo, false))).map((r) => r.trendId),
  );
  const ranked = await db
    .select({ trendId: trendItems.trendId, n: sql<number>`count(*)::int` })
    .from(trendItems)
    .innerJoin(items, eq(trendItems.itemId, items.id))
    .where(eq(items.isDemo, false))
    .groupBy(trendItems.trendId)
    .orderBy(desc(sql`count(*)`));
  const target = ranked.find((r) => r.n >= 4 && !covered.has(r.trendId));
  if (!target) return { careerImpactsGenerated: 0 };

  const [trend] = await db.select().from(trends).where(eq(trends.id, target.trendId)).limit(1);
  const evidence = await db
    .select({ id: items.id, title: items.title, tldr: items.tldr })
    .from(trendItems)
    .innerJoin(items, eq(trendItems.itemId, items.id))
    .where(and(eq(trendItems.trendId, target.trendId), eq(items.isDemo, false)))
    .orderBy(desc(items.score))
    .limit(8);
  if (!trend) return { careerImpactsGenerated: 0 };
  try {
    const out = await gw.llm.generateObject(
      {
        tier: "strong",
        task: "career-impact",
        system: CAREER_SYSTEM,
        messages: [
          {
            role: "user",
            content: `<trend>\n<title>${trend.title}</title>\n<thesis>${trend.thesis}</thesis>\n</trend>\n<evidence>\n${evidence.map((e) => `- ${e.title}: ${e.tldr ?? ""}`).join("\n")}\n</evidence>`,
          },
        ],
        maxOutputTokens: 5000,
      },
      CareerOut,
    );
    await db.insert(careerImpacts).values(out.impacts.map((i) => ({ ...i, trendId: trend.id, sourceItemIds: evidence.slice(0, 5).map((e) => e.id), isDemo: false })));
    return { careerImpactsGenerated: out.impacts.length };
  } catch (err) {
    if (isQuotaStop(err)) throw err;
    log.warn({ err: msg(err), trend: trend.slug }, "career impact generation failed");
    return { careerImpactsGenerated: 0 };
  }
}

// ─── Briefing synthesis (LLM) + weekly report ──────────────────────────────

const OverviewOut = z.object({
  bullets: z.array(z.object({ text: z.string().min(20).max(360), label: z.enum(CLAIM_LABELS), refs: z.array(z.string()) })).min(2).max(5),
});

const OVERVIEW_SYSTEM = `You write the opening synthesis of an AI intelligence briefing. You receive the top-ranked items (ref, source, title, summary).
Write 3-4 bullets that tell a busy reader what mattered and how the items connect.
Rules:
- Use ONLY the supplied items. Every bullet lists the refs it is based on.
- label "fact" for statements directly supported by the cited items, "analysis" for your interpretation, "speculation" for forward-looking statements.
- No hype, no invented details. If summaries are thin, say less.`;

/** Adds a model-written, citation-validated overview to a briefing. Returns the briefing unchanged on any failure. */
export async function addOverview(gw: Gateway, content: Briefing, period: "today" | "this week", log: typeof Logger): Promise<Briefing> {
  if (gw.llm.isMock) return content;
  const ids = [content.headline.itemId, ...content.topStoryIds, content.researchItemId, content.toolItemId, content.repoItemId].filter((v): v is string => Boolean(v));
  const rows = await getDb()
    .select({ id: items.id, title: items.title, tldr: items.tldr, sourceName: sources.name })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .where(inArray(items.id, ids));
  if (rows.length < 3) return content;
  const refs = new Map(rows.map((r, i) => [`s${i + 1}`, r]));
  try {
    const out = await gw.llm.generateObject(
      {
        tier: "strong",
        task: "briefing-overview",
        system: OVERVIEW_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Period: ${period}\n<items>\n${[...refs.entries()].map(([ref, r]) => `<item ref="${ref}" source="${r.sourceName ?? "unknown"}"><title>${r.title}</title><summary>${r.tldr ?? ""}</summary></item>`).join("\n")}\n</items>`,
          },
        ],
        maxOutputTokens: 3000,
      },
      OverviewOut,
    );
    const overview = out.bullets.map((b) => {
      const sourceItemIds = [...new Set(b.refs)].map((r) => refs.get(r)?.id).filter((id): id is string => Boolean(id));
      return { text: b.text, label: b.label === "fact" && sourceItemIds.length === 0 ? ("analysis" as const) : b.label, sourceItemIds };
    });
    return { ...content, overview };
  } catch (err) {
    if (isQuotaStop(err)) throw err;
    log.warn({ err: msg(err) }, "briefing overview failed — keeping deterministic briefing");
    return content;
  }
}

/** "The State of AI — This Week": the 7-day selection, stored once per ISO week (keyed by its Monday). */
export async function buildWeeklyReport(gw: Gateway, now: Date, log: typeof Logger) {
  const db = getDb();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const date = isoDate(monday);

  const rows = await db
    .select({ id: items.id, kind: items.kind, title: items.title, tldr: items.tldr, whyItMatters: items.whyItMatters, category: items.category, score: items.score, metrics: items.metrics })
    .from(items)
    .where(and(eq(items.isDemo, false), gte(items.publishedAt, new Date(now.getTime() - 7 * DAY)), gte(items.score, 40)))
    .orderBy(desc(items.score))
    .limit(200);
  if (rows.filter((r) => r.kind === "article" || r.kind === "launch").length < 5) return { weekly: "skipped (not enough stories this week)" };

  const [trendRows, evidenceRows, exp, startup, skillRows] = await Promise.all([
    db.select().from(trends),
    db.select({ trendId: trendItems.trendId, itemId: trendItems.itemId }).from(trendItems).orderBy(desc(trendItems.relevance)),
    db.select({ slug: experiments.slug }).from(experiments).orderBy(desc(experiments.createdAt)).limit(1),
    db.select({ slug: entities.slug }).from(startupProfiles).innerJoin(entities, eq(startupProfiles.entityId, entities.id)).orderBy(desc(startupProfiles.momentum)).limit(1),
    db.select({ name: entities.name, status: skillStatus }).from(skillStatus).innerJoin(entities, eq(skillStatus.skillId, entities.id)).orderBy(desc(skillStatus.growth30d)),
  ]);
  const evidence = new Map<string, string[]>();
  for (const e of evidenceRows) evidence.set(e.trendId, [...(evidence.get(e.trendId) ?? []), e.itemId]);

  let content = composeBriefing({
    items: rows.map((r) => ({ ...r, starsDelta7d: r.metrics.starsDelta7d })),
    totalItemsConsidered: rows.length,
    trends: trendRows.map((t) => ({ slug: t.slug, title: t.title, thesis: t.thesis, status: t.status, momentum: t.momentum, evidenceItemIds: evidence.get(t.id) ?? [] })),
    experimentSlug: exp[0]?.slug,
    startupSlug: startup[0]?.slug,
    skills: skillRows.map((s) => ({ name: s.name, status: s.status.status, growth: s.status.growth30d, evidenceItemIds: s.status.evidenceItemIds })),
    hourUtc: 6,
  });
  if (!content) return { weekly: "skipped" };
  content = { ...content, title: "The State of AI — This Week", greeting: "This week in AI" };
  content = await addOverview(gw, content, "this week", log);

  const model = content.overview ? `${gw.llm.models.strong} + deterministic-v1` : "deterministic-v1";
  await db
    .insert(briefings)
    .values({ kind: "weekly", date, content, model, generatedAt: now, isDemo: false })
    .onConflictDoUpdate({ target: [briefings.kind, briefings.date], set: { content, model, generatedAt: now } });
  return { weekly: "stored", week: date };
}

/** Runs every insight generator; each is independently skippable and the run stops cleanly on quota limits. */
export async function runInsights(log: typeof Logger, now: Date = new Date()): Promise<Record<string, unknown>> {
  const gw = ai();
  const stats: Record<string, unknown> = { ...(await refreshTrendMomentum(now)) };
  try {
    if (!gw.llm.isMock) {
      Object.assign(stats, await discoverTrends(gw, now, log));
      Object.assign(stats, await generateExperiments(gw, now, log));
      Object.assign(stats, await generateCareerImpacts(gw, log));
    } else {
      stats.generation = "skipped (no AI provider configured)";
    }
    Object.assign(stats, await buildWeeklyReport(gw, now, log));
  } catch (err) {
    if (!isQuotaStop(err)) throw err;
    stats.stopped = msg(err);
  }
  return stats;
}
