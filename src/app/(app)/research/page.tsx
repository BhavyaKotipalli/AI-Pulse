import type { Metadata } from "next";
import { FilterChips } from "@/components/intel/filter-chips";
import { EmptyState, PageHeader } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { titleCase } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { listItems } from "@/server/repositories/items";
import { bookmarkState } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Research radar" };

export default async function ResearchPage({ searchParams }: PageProps<"/research">) {
  const { topic } = await searchParams;
  const active = typeof topic === "string" ? topic : undefined;
  const viewer = await getViewer();
  const papers = await listItems({ kinds: ["paper"], limit: 100 });

  const counts = new Map<string, number>();
  for (const p of papers) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const filtered = active ? papers.filter((p) => p.tags.includes(active)) : papers;
  const saved = viewer ? await bookmarkState(viewer.id, "item", filtered.map((p) => p.id)) : new Map();

  return (
    <div>
      <PageHeader
        eyebrow="Research radar"
        title="Papers that matter, explained"
        description="Ranked by technical significance, novelty and impact. Open any paper for the problem, what's new, how it differs from prior work, reproducibility and project ideas."
      />
      <FilterChips basePath="/research" param="topic" active={active} options={topics.map(([t, n]) => ({ value: t, label: titleCase(t), count: n }))} />
      {filtered.length === 0 ? (
        <EmptyState title="No papers for this topic yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((p) => (
            <StoryCard key={p.id} item={p} saved={saved.get(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
