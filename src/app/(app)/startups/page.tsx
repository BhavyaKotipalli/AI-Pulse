import type { Metadata } from "next";
import { StartupCard } from "@/components/intel/cards";
import { EmptyState, PageHeader } from "@/components/intel/section-header";
import { getViewer } from "@/server/auth/viewer";
import { listStartups } from "@/server/repositories/intel";
import { bookmarkState } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Startup radar" };

export default async function StartupsPage() {
  const viewer = await getViewer();
  const startups = await listStartups(50);
  if (startups.length === 0) return <EmptyState title="No startups tracked yet" />;
  const saved = viewer ? await bookmarkState(viewer.id, "startup", startups.map((s) => s.slug)) : new Map();
  return (
    <div>
      <PageHeader
        eyebrow="Startup radar"
        title="AI startups to watch"
        description="What they solve, the AI underneath, competition, weaknesses — and startup ideas they inspire. Fields not verified against a cited source are marked as such."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {startups.map((s) => (
          <StartupCard key={s.slug} startup={s} saved={saved.get(s.slug)} />
        ))}
      </div>
    </div>
  );
}
