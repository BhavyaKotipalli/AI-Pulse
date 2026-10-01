import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { escapeLike, normalizeQuery, reciprocalRankFusion } from "@/domain/search";
import type { ItemKind } from "@/domain/taxonomy";
import { getEmbedder } from "@/services/ai/registry";
import { getDb } from "@/server/db/client";
import { entities, experiments, items, startupProfiles, trends } from "@/server/db/schema";
import { getItemsByIds, type ItemSummary } from "./items";

const ftsDocument = sql`to_tsvector('english', ${items.title} || ' ' || coalesce(${items.tldr}, '') || ' ' || coalesce(${items.snippet}, '') || ' ' || array_to_string(${items.tags}, ' '))`;

export interface RetrievedItem extends ItemSummary {
  similarity: number;
  textMatch: boolean;
  fusedScore: number;
}

/**
 * Hybrid retrieval: pgvector cosine similarity + Postgres full-text search, fused with RRF.
 * Final ordering blends the fused rank with the item's intelligence score so high-signal
 * items win ties.
 */
export async function hybridSearchItems(
  rawQuery: string,
  opts: { limit?: number; kinds?: ItemKind[] } = {},
): Promise<RetrievedItem[]> {
  const q = normalizeQuery(rawQuery);
  if (!q) return [];
  const db = getDb();
  const limit = opts.limit ?? 10;
  const kindFilter = opts.kinds?.length ? inArray(items.kind, opts.kinds) : undefined;

  const [queryVector] = await getEmbedder().embed([q]);
  const vectorLiteral = `[${queryVector!.join(",")}]`;
  const similarity = sql<number>`1 - (${items.embedding} <=> ${vectorLiteral}::vector)`;

  const [vectorHits, textHits] = await Promise.all([
    db
      .select({ id: items.id, similarity })
      .from(items)
      .where(kindFilter)
      .orderBy(sql`${items.embedding} <=> ${vectorLiteral}::vector`)
      .limit(limit * 3),
    db
      .select({ id: items.id })
      .from(items)
      .where(and(kindFilter, sql`${ftsDocument} @@ websearch_to_tsquery('english', ${q})`))
      .orderBy(desc(sql`ts_rank(${ftsDocument}, websearch_to_tsquery('english', ${q}))`))
      .limit(limit * 3),
  ]);

  const simById = new Map(vectorHits.map((h) => [h.id, Number(h.similarity)]));
  const textIds = new Set(textHits.map((h) => h.id));
  const fused = reciprocalRankFusion([vectorHits.map((h) => h.id), textHits.map((h) => h.id)]);
  const candidates = fused.slice(0, limit * 2);
  const summaries = await getItemsByIds(candidates.map((c) => c.id));
  const fusedById = new Map(candidates.map((c) => [c.id, c.score]));

  return summaries
    .map((s) => ({
      ...s,
      similarity: simById.get(s.id) ?? 0,
      textMatch: textIds.has(s.id),
      fusedScore: (fusedById.get(s.id) ?? 0) * (0.75 + s.score / 400),
    }))
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, limit);
}

export interface SearchHit {
  type: "item" | "trend" | "experiment" | "startup" | "entity";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
}

/** Global search across every intelligence type (command palette + search page). */
export async function globalSearch(rawQuery: string, limit = 6): Promise<SearchHit[]> {
  const q = normalizeQuery(rawQuery, 120);
  if (q.length < 2) return [];
  const like = `%${escapeLike(q)}%`;
  const db = getDb();

  const [itemHits, trendHits, expHits, startupHits, entityHits] = await Promise.all([
    hybridSearchItems(q, { limit }),
    db
      .select({ slug: trends.slug, title: trends.title, thesis: trends.thesis })
      .from(trends)
      .where(or(ilike(trends.title, like), ilike(trends.thesis, like), ilike(trends.summary, like)))
      .limit(4),
    db
      .select({ slug: experiments.slug, title: experiments.title, difficulty: experiments.difficulty, time: experiments.timeEstimate })
      .from(experiments)
      .where(or(ilike(experiments.title, like), ilike(experiments.summary, like), sql`array_to_string(${experiments.skills}, ' ') ilike ${like}`))
      .limit(4),
    db
      .select({ slug: entities.slug, name: entities.name, tagline: startupProfiles.tagline })
      .from(startupProfiles)
      .innerJoin(entities, eq(startupProfiles.entityId, entities.id))
      .where(or(ilike(entities.name, like), ilike(startupProfiles.product, like), ilike(startupProfiles.tagline, like)))
      .limit(4),
    db
      .select({ slug: entities.slug, name: entities.name, type: entities.type, description: entities.description })
      .from(entities)
      .where(and(sql`${entities.type} <> 'startup'`, or(ilike(entities.name, like), sql`array_to_string(${entities.aliases}, ' ') ilike ${like}`)))
      .limit(5),
  ]);

  return [
    ...itemHits
      .filter((i) => i.textMatch || i.similarity >= getEmbedder().relevanceFloor)
      .map<SearchHit>((i) => ({
      type: "item",
      id: i.id,
      title: i.title,
      subtitle: i.tldr ?? "",
      href: `/intel/${i.id}`,
      meta: `${i.kind} · ${i.score}`,
    })),
    ...trendHits.map<SearchHit>((t) => ({ type: "trend", id: t.slug, title: t.title, subtitle: t.thesis, href: `/trends/${t.slug}` })),
    ...expHits.map<SearchHit>((e) => ({ type: "experiment", id: e.slug, title: e.title, subtitle: `${e.difficulty} · ${e.time}`, href: `/experiments/${e.slug}` })),
    ...startupHits.map<SearchHit>((s) => ({ type: "startup", id: s.slug, title: s.name, subtitle: s.tagline, href: `/startups/${s.slug}` })),
    ...entityHits.map<SearchHit>((e) => ({
      type: "entity",
      id: `${e.type}:${e.slug}`,
      title: e.name,
      subtitle: e.description ?? "",
      href: `/search?q=${encodeURIComponent(e.name)}`,
      meta: e.type,
    })),
  ];
}
