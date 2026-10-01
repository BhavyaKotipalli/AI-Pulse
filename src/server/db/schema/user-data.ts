import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { BookmarkTarget, Collection, Interest, Role } from "@/domain/taxonomy";
import { user } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const userRef = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  interests: text("interests").array().$type<Interest[]>().notNull().default(sql`'{}'::text[]`),
  roles: text("roles").array().$type<Role[]>().notNull().default(sql`'{}'::text[]`),
  experienceLevel: text("experience_level").$type<"student" | "junior" | "mid" | "senior">().notNull().default("mid"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: id(),
    userId: userRef(),
    targetType: text("target_type").$type<BookmarkTarget>().notNull(),
    targetId: text("target_id").notNull(),
    collection: text("collection").$type<Collection>().notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookmarks_uq").on(t.userId, t.targetType, t.targetId, t.collection),
    index("bookmarks_user_idx").on(t.userId, t.createdAt),
  ],
);

export const userEvents = pgTable(
  "user_events",
  {
    id: id(),
    userId: userRef(),
    type: text("type").$type<"view" | "save" | "ask" | "experiment_start">().notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("user_events_user_idx").on(t.userId, t.createdAt)],
);

export const conversations = pgTable("conversations", {
  id: id(),
  userId: userRef(),
  title: text("title").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export interface MessageCitation {
  index: number;
  itemId: string;
  title: string;
  url: string;
  source: string | null;
  publishedAt: string;
}

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<MessageCitation[]>().notNull().default([]),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

// ─── Operations ────────────────────────────────────────────────────────────

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    tier: text("tier").$type<"fast" | "strong" | "embedding">().notNull(),
    task: text("task").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    cached: integer("cached").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    job: text("job").notNull(),
    status: text("status").$type<"running" | "succeeded" | "failed" | "skipped">().notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
  },
  (t) => [index("job_runs_job_idx").on(t.job, t.startedAt)],
);
