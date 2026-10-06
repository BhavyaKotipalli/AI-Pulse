import { z } from "zod";
import { AUDIENCES, CLAIM_LABELS, CONFIDENCE_LEVELS, DIFFICULTIES } from "./taxonomy";

/** A single statement with provenance. `fact` must be backed by at least one source. */
export const ClaimSchema = z.object({
  text: z.string().min(1),
  label: z.enum(CLAIM_LABELS),
  sourceItemIds: z.array(z.string()).default([]),
  confidence: z.enum(CONFIDENCE_LEVELS).default("medium"),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** "What should I do?" engine output. */
export const ActionSchema = z.object({
  action: z.string(),
  experiment: z.string(),
  timeEstimate: z.string(),
  careerRelevance: z.enum(["high", "medium", "low"]),
});
export type RecommendedAction = z.infer<typeof ActionSchema>;

/** "Why should I care?" engine output — one line per audience. */
export const AudiencesSchema = z.record(z.enum(AUDIENCES), z.string());
export type Audiences = z.infer<typeof AudiencesSchema>;

export const CareerNoteSchema = z.object({
  rolesAffected: z.array(z.string()),
  automated: z.array(z.string()),
  augmented: z.array(z.string()),
  skillsRising: z.array(z.string()),
});

export const ArticleAnalysisSchema = z.object({
  kind: z.literal("article"),
  technical: z.string(),
  beginner: z.string(),
  audiences: AudiencesSchema,
  action: ActionSchema,
  claims: z.array(ClaimSchema),
  career: CareerNoteSchema.optional(),
});

export const PaperAnalysisSchema = z.object({
  kind: z.literal("paper"),
  problem: z.string(),
  novelty: z.string(),
  priorWorkDelta: z.string(),
  whyItMatters: z.string(),
  reproducibility: z.string(),
  projectPotential: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  beginner: z.string(),
  audiences: AudiencesSchema,
  action: ActionSchema,
  claims: z.array(ClaimSchema),
});

export const RepoAnalysisSchema = z.object({
  kind: z.literal("repo"),
  whyDiscussed: z.string(),
  useCases: z.array(z.string()),
  projectIdeas: z.array(z.string()),
  beginner: z.string(),
  audiences: AudiencesSchema,
  action: ActionSchema,
  claims: z.array(ClaimSchema),
});

export const ItemAnalysisSchema = z.discriminatedUnion("kind", [
  ArticleAnalysisSchema,
  PaperAnalysisSchema,
  RepoAnalysisSchema,
]);
export type ItemAnalysis = z.infer<typeof ItemAnalysisSchema>;
export type ArticleAnalysis = z.infer<typeof ArticleAnalysisSchema>;
export type PaperAnalysis = z.infer<typeof PaperAnalysisSchema>;
export type RepoAnalysis = z.infer<typeof RepoAnalysisSchema>;

export const ItemMetricsSchema = z.object({
  stars: z.number().int().nonnegative().optional(),
  starsDelta7d: z.number().int().optional(),
  forks: z.number().int().nonnegative().optional(),
  language: z.string().optional(),
  hnPoints: z.number().int().nonnegative().optional(),
  hnComments: z.number().int().nonnegative().optional(),
  arxivId: z.string().optional(),
  authors: z.array(z.string()).optional(),
  pricing: z.string().optional(),
  /** Slugs of other sources that also covered/linked this exact URL (idempotent corroboration). */
  seenIn: z.array(z.string()).optional(),
});
export type ItemMetrics = z.infer<typeof ItemMetricsSchema>;

export const ExperimentStepSchema = z.object({
  title: z.string(),
  detail: z.string(),
});
export type ExperimentStep = z.infer<typeof ExperimentStepSchema>;

export const BuildPlanSchema = z.object({
  overview: z.string(),
  milestones: z.array(z.object({ title: z.string(), outcome: z.string(), tasks: z.array(z.string()).min(1) })).min(2).max(8),
  repoStructure: z.array(z.string()).max(25),
  evaluation: z.array(z.string()).min(1).max(8),
  risks: z.array(z.string()).max(6),
  stretchGoals: z.array(z.string()).max(6),
});
export type BuildPlan = z.infer<typeof BuildPlanSchema>;

export const BriefingBulletSchema = z.object({
  text: z.string(),
  label: z.enum(CLAIM_LABELS),
  sourceItemIds: z.array(z.string()),
});

export const BriefingSchema = z.object({
  greeting: z.string(),
  headline: z.object({ itemId: z.string(), summary: z.string(), whyItMatters: z.string() }),
  topStoryIds: z.array(z.string()),
  researchItemId: z.string().optional(),
  toolItemId: z.string().optional(),
  repoItemId: z.string().optional(),
  jobs: z.array(BriefingBulletSchema),
  startupSlug: z.string().optional(),
  experimentSlug: z.string().optional(),
  skill: z.object({ name: z.string(), reason: z.string() }).optional(),
  emergingTrendSlug: z.string().optional(),
  payAttention: z.array(BriefingBulletSchema),
  /** Optional model-written synthesis; every bullet is validated to cite supplied items. */
  overview: z.array(BriefingBulletSchema).optional(),
  title: z.string().optional(),
  readingMinutes: z.number().int().positive(),
});
export type Briefing = z.infer<typeof BriefingSchema>;
