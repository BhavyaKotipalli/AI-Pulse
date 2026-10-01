import type { Metadata } from "next";
import { ExperimentCard } from "@/components/intel/cards";
import { FilterChips } from "@/components/intel/filter-chips";
import { EmptyState, PageHeader } from "@/components/intel/section-header";
import { DIFFICULTIES, type Difficulty } from "@/domain/taxonomy";
import { titleCase } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { listExperiments } from "@/server/repositories/intel";
import { bookmarkState } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Experiment lab" };

export default async function ExperimentsPage({ searchParams }: PageProps<"/experiments">) {
  const { difficulty } = await searchParams;
  const active = DIFFICULTIES.includes(difficulty as Difficulty) ? (difficulty as Difficulty) : undefined;
  const viewer = await getViewer();
  const all = await listExperiments(100);
  const list = active ? all.filter((e) => e.difficulty === active) : all;
  const saved = viewer ? await bookmarkState(viewer.id, "experiment", list.map((e) => e.id)) : new Map();

  return (
    <div>
      <PageHeader
        eyebrow="Experiment lab"
        title="Experiments you can build"
        description="Every interesting model, paper, tool or repository becomes a buildable project — with skills learned, architecture, time estimate and portfolio value."
      />
      <FilterChips
        basePath="/experiments"
        param="difficulty"
        active={active}
        options={DIFFICULTIES.map((d) => ({ value: d, label: titleCase(d), count: all.filter((e) => e.difficulty === d).length })).filter((o) => o.count > 0)}
      />
      {list.length === 0 ? (
        <EmptyState title="No experiments at this level yet" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e, i) => (
            <ExperimentCard key={e.id} exp={e} saved={saved.get(e.id)} featured={i === 0 && !active} />
          ))}
        </div>
      )}
    </div>
  );
}
