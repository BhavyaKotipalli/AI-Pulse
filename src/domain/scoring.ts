import { z } from "zod";

/**
 * Intelligence Score — deterministic, explainable ranking.
 * LLM stages only produce bounded sub-scores; this module combines them so every
 * score can be reproduced and explained in the UI.
 */
export const SCORING_VERSION = 1;

export const SCORE_DIMENSIONS = [
  "impact",
  "novelty",
  "technical",
  "industry",
  "career",
  "momentum",
  "credibility",
  "recency",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const SCORE_WEIGHTS: Record<ScoreDimension, number> = {
  impact: 0.22,
  novelty: 0.14,
  technical: 0.14,
  industry: 0.12,
  career: 0.1,
  momentum: 0.1,
  credibility: 0.1,
  recency: 0.08,
};

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  impact: "Impact",
  novelty: "Novelty",
  technical: "Technical significance",
  industry: "Industry relevance",
  career: "Career relevance",
  momentum: "Community momentum",
  credibility: "Source credibility",
  recency: "Recency",
};

const unit = z.number().min(0).max(100);

/** Sub-scores produced by the classifier (LLM, fast tier) — 0–100 each. */
export const SubScoresSchema = z.object({
  impact: unit,
  novelty: unit,
  technical: unit,
  industry: unit,
  career: unit,
  /** 0 = not clickbait, 1 = pure clickbait. */
  clickbait: z.number().min(0).max(1),
});
export type SubScores = z.infer<typeof SubScoresSchema>;

export interface ScoreInputs {
  sub: SubScores;
  /** Source prior 0–1 (from `sources.credibility`). */
  sourceCredibility: number;
  /** Number of independent sources covering the same story cluster. */
  corroboratingSources: number;
  /** Normalized community signal 0–100 (HN points, star growth, cluster size). */
  momentum: number;
  publishedAt: Date;
  now?: Date;
  /** How the sub-scores were produced; surfaced in the UI so heuristic scores are never mistaken for model judgments. */
  method?: ScoreMethod;
}

export type ScoreMethod = "llm" | "heuristic" | "demo";

export interface ScoreBreakdown {
  version: number;
  method?: ScoreMethod;
  dimensions: Record<ScoreDimension, number>;
  clickbaitPenalty: number;
  corroborationBonus: number;
  score: number;
}

const RECENCY_HALF_LIFE_HOURS = 36;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Exponential decay: 100 at publish time, 50 after one half-life. */
export function recencyScore(publishedAt: Date, now: Date = new Date()): number {
  const hours = Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000);
  return 100 * Math.pow(0.5, hours / RECENCY_HALF_LIFE_HOURS);
}

/** Up to +6 % for stories covered by 2–4+ independent sources. */
export function corroborationBonus(sources: number): number {
  if (sources <= 1) return 1;
  return 1 + Math.min(3, sources - 1) * 0.02;
}

export function computeScore(input: ScoreInputs): ScoreBreakdown {
  const dimensions: Record<ScoreDimension, number> = {
    impact: input.sub.impact,
    novelty: input.sub.novelty,
    technical: input.sub.technical,
    industry: input.sub.industry,
    career: input.sub.career,
    momentum: clamp(input.momentum, 0, 100),
    credibility: clamp(input.sourceCredibility, 0, 1) * 100,
    recency: recencyScore(input.publishedAt, input.now),
  };

  const base = SCORE_DIMENSIONS.reduce((sum, d) => sum + SCORE_WEIGHTS[d] * dimensions[d], 0);
  const clickbaitPenalty = 1 - 0.35 * clamp(input.sub.clickbait, 0, 1);
  const bonus = corroborationBonus(input.corroboratingSources);
  const score = Math.round(clamp(base * clickbaitPenalty * bonus, 0, 100));

  return {
    version: SCORING_VERSION,
    method: input.method ?? "llm",
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((d) => [d, Math.round(dimensions[d])]),
    ) as Record<ScoreDimension, number>,
    clickbaitPenalty: Number(clickbaitPenalty.toFixed(3)),
    corroborationBonus: Number(bonus.toFixed(3)),
    score,
  };
}

export type ScoreBand = "critical" | "high" | "notable" | "low";

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "notable";
  return "low";
}

/** Items at or above this score receive deep (strong-tier) analysis. */
export const DEEP_ANALYSIS_THRESHOLD = 65;
/** Items at or above this score require multi-source corroboration to avoid a "single source" flag. */
export const MAJOR_STORY_THRESHOLD = 70;

/** Recovers the inputs of a stored breakdown so the score can be recomputed (e.g. to refresh recency). */
export function rescore(b: ScoreBreakdown, publishedAt: Date, corroboratingSources: number, now: Date = new Date()): ScoreBreakdown {
  const clickbait = Math.min(1, Math.max(0, (1 - b.clickbaitPenalty) / 0.35));
  return computeScore({
    sub: { impact: b.dimensions.impact, novelty: b.dimensions.novelty, technical: b.dimensions.technical, industry: b.dimensions.industry, career: b.dimensions.career, clickbait },
    sourceCredibility: b.dimensions.credibility / 100,
    corroboratingSources,
    momentum: b.dimensions.momentum,
    publishedAt,
    now,
    method: b.method,
  });
}
