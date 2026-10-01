import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import type { ItemAnalysis, ItemMetrics, Claim, ExperimentStep, Briefing } from "@/domain/analysis";
import { EMBEDDING_DIMENSIONS } from "@/domain/constants";
import type { ScoreBreakdown } from "@/domain/scoring";
import type {
  Category,
  Confidence,
  Difficulty,
  EntityType,
  ItemKind,
  RelationType,
  Role,
  SkillStatus,
  SourceKind,
  TrendStatus,
} from "@/domain/taxonomy";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());

// ─── Sources & items ────────────────────────────────────────────────────────

export const sources = pgTable("sources", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").$type<SourceKind>().notNull(),
  url: text("url").notNull(),
  homepage: text("homepage"),
  credibility: real("credibility").notNull().default(0.6),
  active: boolean("active").notNull().default(true),
  etag: text("etag"),
  lastFetchedAt: ts("last_fetched_at"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const storyClusters = pgTable("story_clusters", {
  id: id(),
  title: text("title").notNull(),
  leadItemId: text("lead_item_id"),
  itemCount: integer("item_count").notNull().default(1),
  sourceCount: integer("source_count").notNull().default(1),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: id(),
    kind: text("kind").$type<ItemKind>().notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(),
    sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
    author: text("author"),
    publishedAt: ts("published_at").notNull(),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
    snippet: text("snippet"),
    contentHash: text("content_hash"),
    category: text("category").$type<Category>(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    tldr: text("tldr"),
    whyItMatters: text("why_it_matters"),
    analysis: jsonb("analysis").$type<ItemAnalysis>(),
    score: integer("score").notNull().default(0),
    scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>(),
    confidence: text("confidence").$type<Confidence>().notNull().default("medium"),
    clusterId: text("cluster_id").references(() => storyClusters.id, { onDelete: "set null" }),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    metrics: jsonb("metrics").$type<ItemMetrics>().notNull().default({}),
    status: text("status").$type<"raw" | "normalized" | "enriched" | "enrich_failed">().notNull().default("raw"),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [
    uniqueIndex("items_url_hash_uq").on(t.urlHash),
    index("items_published_idx").on(t.publishedAt.desc()),
    index("items_score_idx").on(t.score.desc()),
    index("items_kind_published_idx").on(t.kind, t.publishedAt),
    index("items_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const itemMetricSnapshots = pgTable(
  "item_metric_snapshots",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    capturedAt: ts("captured_at").notNull().defaultNow(),
    metrics: jsonb("metrics").$type<ItemMetrics>().notNull(),
  },
  (t) => [index("item_snapshots_item_idx").on(t.itemId, t.capturedAt)],
);

// ─── Knowledge graph ────────────────────────────────────────────────────────

export const entities = pgTable(
  "entities",
  {
    id: id(),
    type: text("type").$type<EntityType>().notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    url: text("url"),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [uniqueIndex("entities_type_slug_uq").on(t.type, t.slug)],
);

export const itemEntities = pgTable(
  "item_entities",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    salience: real("salience").notNull().default(0.5),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.entityId] }), index("item_entities_entity_idx").on(t.entityId)],
);

export const entityRelations = pgTable(
  "entity_relations",
  {
    id: id(),
    sourceEntityId: text("source_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetEntityId: text("target_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relation: text("relation").$type<RelationType>().notNull(),
    weight: real("weight").notNull().default(1),
    evidenceItemIds: text("evidence_item_ids").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [uniqueIndex("entity_relations_uq").on(t.sourceEntityId, t.targetEntityId, t.relation)],
);

// ─── Trends ─────────────────────────────────────────────────────────────────

export const trends = pgTable("trends", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  thesis: text("thesis").notNull(),
  summary: text("summary").notNull(),
  status: text("status").$type<TrendStatus>().notNull(),
  momentum: real("momentum").notNull().default(0),
  whyHappening: text("why_happening").notNull(),
  implications: jsonb("implications").$type<Claim[]>().notNull().default([]),
  affectedRoles: text("affected_roles").array().$type<Role[]>().notNull().default(sql`'{}'::text[]`),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  chain: text("chain").array().notNull().default(sql`'{}'::text[]`),
  firstSeenAt: ts("first_seen_at").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const trendItems = pgTable(
  "trend_items",
  {
    trendId: text("trend_id")
      .notNull()
      .references(() => trends.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    relevance: real("relevance").notNull().default(0.5),
  },
  (t) => [primaryKey({ columns: [t.trendId, t.itemId] })],
);

export const trendEntities = pgTable(
  "trend_entities",
  {
    trendId: text("trend_id")
      .notNull()
      .references(() => trends.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.trendId, t.entityId] })],
);

export const trendSnapshots = pgTable(
  "trend_snapshots",
  {
    trendId: text("trend_id")
      .notNull()
      .references(() => trends.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    mentionCount: integer("mention_count").notNull(),
    score: real("score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.trendId, t.date] })],
);

// ─── Career intelligence ───────────────────────────────────────────────────

export const skillSignals = pgTable(
  "skill_signals",
  {
    skillId: text("skill_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    mentions: integer("mentions").notNull().default(0),
    repoMentions: integer("repo_mentions").notNull().default(0),
    jobMentions: integer("job_mentions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.skillId, t.date] })],
);

export const skillStatus = pgTable("skill_status", {
  skillId: text("skill_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  status: text("status").$type<SkillStatus>().notNull(),
  growth30d: real("growth_30d"),
  last30: integer("last_30").notNull().default(0),
  prev30: integer("prev_30").notNull().default(0),
  evidenceItemIds: text("evidence_item_ids").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const careerImpacts = pgTable(
  "career_impacts",
  {
    id: id(),
    role: text("role").$type<Role>().notNull(),
    trendId: text("trend_id").references(() => trends.id, { onDelete: "cascade" }),
    headline: text("headline").notNull(),
    automated: text("automated").array().notNull().default(sql`'{}'::text[]`),
    augmented: text("augmented").array().notNull().default(sql`'{}'::text[]`),
    newSkills: text("new_skills").array().notNull().default(sql`'{}'::text[]`),
    decliningSkills: text("declining_skills").array().notNull().default(sql`'{}'::text[]`),
    newRoles: text("new_roles").array().notNull().default(sql`'{}'::text[]`),
    tools: text("tools").array().notNull().default(sql`'{}'::text[]`),
    studentAdvice: text("student_advice").notNull(),
    exposure: integer("exposure").notNull().default(50), // 0–100 how much the role is changing
    confidence: text("confidence").$type<Confidence>().notNull().default("medium"),
    sourceItemIds: text("source_item_ids").array().notNull().default(sql`'{}'::text[]`),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [index("career_impacts_role_idx").on(t.role)],
);

// ─── Experiments & startups ─────────────────────────────────────────────────

export const experiments = pgTable("experiments", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  whyInteresting: text("why_interesting").notNull(),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  technologies: text("technologies").array().notNull().default(sql`'{}'::text[]`),
  difficulty: text("difficulty").$type<Difficulty>().notNull(),
  timeEstimate: text("time_estimate").notNull(),
  architecture: text("architecture").notNull(),
  dataRequirements: text("data_requirements").notNull(),
  expectedResult: text("expected_result").notNull(),
  githubPotential: integer("github_potential").notNull(),
  resumeValue: integer("resume_value").notNull(),
  startupPotential: integer("startup_potential").notNull(),
  steps: jsonb("steps").$type<ExperimentStep[]>().notNull().default([]),
  sourceItemIds: text("source_item_ids").array().notNull().default(sql`'{}'::text[]`),
  trendId: text("trend_id").references(() => trends.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const startupProfiles = pgTable("startup_profiles", {
  entityId: text("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  tagline: text("tagline").notNull(),
  problem: text("problem").notNull(),
  product: text("product").notNull(),
  aiTech: text("ai_tech").notNull(),
  fundingStage: text("funding_stage"),
  investors: text("investors").array().notNull().default(sql`'{}'::text[]`),
  founders: text("founders").array().notNull().default(sql`'{}'::text[]`),
  market: text("market").notNull(),
  competitors: text("competitors").array().notNull().default(sql`'{}'::text[]`),
  interesting: text("interesting").notNull(),
  weaknesses: text("weaknesses").notNull(),
  ideas: text("ideas").array().notNull().default(sql`'{}'::text[]`),
  verifiedFields: text("verified_fields").array().notNull().default(sql`'{}'::text[]`),
  sourceItemIds: text("source_item_ids").array().notNull().default(sql`'{}'::text[]`),
  momentum: integer("momentum").notNull().default(50),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ─── Briefings ─────────────────────────────────────────────────────────────

export const briefings = pgTable(
  "briefings",
  {
    id: id(),
    kind: text("kind").$type<"daily" | "weekly">().notNull(),
    date: text("date").notNull(),
    content: jsonb("content").$type<Briefing>().notNull(),
    model: text("model").notNull(),
    generatedAt: ts("generated_at").notNull().defaultNow(),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [uniqueIndex("briefings_kind_date_uq").on(t.kind, t.date)],
);
