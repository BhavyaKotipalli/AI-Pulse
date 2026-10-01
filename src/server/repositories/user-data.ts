import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { BookmarkTarget, Collection, Interest, Role } from "@/domain/taxonomy";
import { getDb } from "@/server/db/client";
import { aiUsage, bookmarks, items, userEvents, userPreferences } from "@/server/db/schema";

export type BookmarkRow = typeof bookmarks.$inferSelect;

export async function listBookmarks(userId: string, collection?: Collection): Promise<BookmarkRow[]> {
  return getDb()
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), collection ? eq(bookmarks.collection, collection) : undefined))
    .orderBy(desc(bookmarks.createdAt));
}

/** Returns `targetId → collections[]` for the given targets, so cards can render saved state. */
export async function bookmarkState(userId: string, targetType: BookmarkTarget, targetIds: string[]) {
  const map = new Map<string, Collection[]>();
  if (targetIds.length === 0) return map;
  const rows = await getDb()
    .select({ targetId: bookmarks.targetId, collection: bookmarks.collection })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.targetType, targetType), inArray(bookmarks.targetId, targetIds)));
  for (const r of rows) map.set(r.targetId, [...(map.get(r.targetId) ?? []), r.collection]);
  return map;
}

export async function addBookmark(userId: string, targetType: BookmarkTarget, targetId: string, collection: Collection) {
  await getDb().insert(bookmarks).values({ userId, targetType, targetId, collection }).onConflictDoNothing();
}

export async function removeBookmark(userId: string, targetType: BookmarkTarget, targetId: string, collection: Collection) {
  await getDb()
    .delete(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.targetType, targetType),
        eq(bookmarks.targetId, targetId),
        eq(bookmarks.collection, collection),
      ),
    );
}

export async function getPreferences(userId: string): Promise<{ interests: Interest[]; roles: Role[] }> {
  const [row] = await getDb().select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return { interests: row?.interests ?? [], roles: row?.roles ?? [] };
}

export async function savePreferences(userId: string, interests: Interest[], roles: Role[]) {
  await getDb()
    .insert(userPreferences)
    .values({ userId, interests, roles })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { interests, roles, updatedAt: new Date() } });
}

export async function recordEvent(
  userId: string,
  type: (typeof userEvents.$inferInsert)["type"],
  target?: { type: string; id: string },
  topics: string[] = [],
) {
  await getDb().insert(userEvents).values({ userId, type, targetType: target?.type, targetId: target?.id, topics });
}

/** Tags of items the user saved recently — the behavioural signal for personalization. */
export async function engagedTopics(userId: string, days = 30): Promise<string[]> {
  const rows = await getDb()
    .select({ tags: items.tags })
    .from(bookmarks)
    .innerJoin(items, eq(bookmarks.targetId, items.id))
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.targetType, "item"), gte(bookmarks.createdAt, new Date(Date.now() - days * 86_400_000))));
  return [...new Set(rows.flatMap((r) => r.tags))];
}

export async function usageSummary(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const db = getDb();
  const [totals] = await db
    .select({
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since));
  const byTask = await db
    .select({
      task: aiUsage.task,
      provider: aiUsage.provider,
      model: aiUsage.model,
      requests: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since))
    .groupBy(aiUsage.task, aiUsage.provider, aiUsage.model)
    .orderBy(desc(sql`count(*)`));
  return { totals: totals ?? { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }, byTask };
}

export async function recordUsage(row: typeof aiUsage.$inferInsert) {
  await getDb().insert(aiUsage).values(row);
}
