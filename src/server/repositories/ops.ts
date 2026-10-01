import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { items, sources } from "@/server/db/schema";

export async function sourcesOverview() {
  return getDb()
    .select({
      slug: sources.slug,
      name: sources.name,
      kind: sources.kind,
      homepage: sources.homepage,
      credibility: sources.credibility,
      lastFetchedAt: sources.lastFetchedAt,
      isDemo: sources.isDemo,
      items: sql<number>`count(${items.id})::int`,
      newest: sql<Date | null>`max(${items.publishedAt})`,
    })
    .from(sources)
    .leftJoin(items, eq(items.sourceId, sources.id))
    .where(eq(sources.isDemo, false))
    .groupBy(sources.id)
    .orderBy(desc(sql`count(${items.id})`));
}

/** Counts used to decide which data-provenance banner to show. */
export async function contentMix(): Promise<{ demo: number; live: number }> {
  const [row] = await getDb()
    .select({
      demo: sql<number>`count(*) filter (where ${items.isDemo})::int`,
      live: sql<number>`count(*) filter (where not ${items.isDemo})::int`,
    })
    .from(items);
  return row ?? { demo: 0, live: 0 };
}
