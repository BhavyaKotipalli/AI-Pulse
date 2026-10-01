import type { Metadata } from "next";
import Link from "next/link";
import { ExperimentCard, StartupCard, TrendCard } from "@/components/intel/cards";
import { FilterChips } from "@/components/intel/filter-chips";
import { EmptyState, PageHeader, SectionHeader } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { Button } from "@/components/ui/button";
import { COLLECTION_LABELS, COLLECTIONS, type Collection } from "@/domain/taxonomy";
import { getViewer } from "@/server/auth/viewer";
import { getExperimentsByIds, listStartups, listTrends } from "@/server/repositories/intel";
import { getItemsByIds } from "@/server/repositories/items";
import { hybridSearchItems } from "@/server/repositories/search";
import { getEmbedder } from "@/services/ai/registry";
import { listBookmarks } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Knowledge library" };

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const sp = await searchParams;
  const collection = COLLECTIONS.includes(sp.collection as Collection) ? (sp.collection as Collection) : undefined;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <EmptyState title="Sign in to build your library" description="Save articles, papers, tools, startups, experiments and trends into collections.">
        <Button asChild variant="primary">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </EmptyState>
    );
  }

  const all = await listBookmarks(viewer.id);
  const marks = collection ? all.filter((b) => b.collection === collection) : all;
  const ids = (type: string) => [...new Set(marks.filter((m) => m.targetType === type).map((m) => m.targetId))];

  let itemIds = ids("item");
  if (query) {
    // Semantic search restricted to saved items.
    const hits = await hybridSearchItems(query, { limit: 50 });
    const savedSet = new Set(itemIds);
    itemIds = hits.filter((h) => savedSet.has(h.id) && (h.textMatch || h.similarity >= getEmbedder().relevanceFloor)).map((h) => h.id);
  }

  const [items, experiments, trends, startups] = await Promise.all([
    getItemsByIds(itemIds),
    query ? Promise.resolve([]) : getExperimentsByIds(ids("experiment")),
    query ? Promise.resolve([]) : listTrends(100),
    query ? Promise.resolve([]) : listStartups(100),
  ]);
  const trendIds = new Set(ids("trend"));
  const startupSlugs = new Set(ids("startup"));
  const savedTrends = trends.filter((t) => trendIds.has(t.id));
  const savedStartups = startups.filter((s) => startupSlugs.has(s.slug));
  const total = items.length + experiments.length + savedTrends.length + savedStartups.length;
  const counts = new Map<Collection, number>();
  for (const b of all) counts.set(b.collection, (counts.get(b.collection) ?? 0) + 1);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Knowledge library"
        title="Your saved intelligence"
        description={viewer.isGuest ? "You're browsing as the shared demo guest — sign in to keep a private library." : "Everything you've saved, organized into collections."}
      />
      <form action="/library" className="flex gap-2">
        {collection && <input type="hidden" name="collection" value={collection} />}
        <input
          name="q"
          defaultValue={query}
          placeholder="Semantic search across your saved items…"
          aria-label="Search your library"
          className="h-10 flex-1 rounded-lg border border-line bg-surface-1 px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent/40"
        />
        <Button type="submit">Search</Button>
      </form>
      <FilterChips
        basePath="/library"
        param="collection"
        active={collection}
        allLabel="All collections"
        options={COLLECTIONS.map((c) => ({ value: c, label: COLLECTION_LABELS[c], count: counts.get(c) ?? 0 }))}
      />

      {total === 0 ? (
        <EmptyState
          title={query ? "No saved items match that search" : "Nothing saved here yet"}
          description="Use the bookmark icon on any story, paper, repository, experiment, trend or startup."
        />
      ) : (
        <>
          {items.length > 0 && (
            <section>
              <SectionHeader title="Stories, papers & tools" />
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((i) => (
                  <StoryCard key={i.id} item={i} saved={all.filter((b) => b.targetId === i.id).map((b) => b.collection)} />
                ))}
              </div>
            </section>
          )}
          {experiments.length > 0 && (
            <section>
              <SectionHeader title="Experiments & projects" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {experiments.map((e) => (
                  <ExperimentCard key={e.id} exp={e} saved={all.filter((b) => b.targetId === e.id).map((b) => b.collection)} />
                ))}
              </div>
            </section>
          )}
          {savedTrends.length > 0 && (
            <section>
              <SectionHeader title="Trends" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {savedTrends.map((t) => (
                  <TrendCard key={t.id} trend={t} saved={all.filter((b) => b.targetId === t.id).map((b) => b.collection)} />
                ))}
              </div>
            </section>
          )}
          {savedStartups.length > 0 && (
            <section>
              <SectionHeader title="Startups" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {savedStartups.map((s) => (
                  <StartupCard key={s.slug} startup={s} saved={all.filter((b) => b.targetId === s.slug).map((b) => b.collection)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
