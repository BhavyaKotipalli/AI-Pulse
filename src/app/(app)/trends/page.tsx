import type { Metadata } from "next";
import { TrendCard } from "@/components/intel/cards";
import { EmptyState, PageHeader, SectionHeader } from "@/components/intel/section-header";
import { Card } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/domain/taxonomy";
import { getViewer } from "@/server/auth/viewer";
import { listTrends } from "@/server/repositories/intel";
import { categoryCounts, topEntities } from "@/server/repositories/items";
import { bookmarkState } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Trends" };

function BarList({ rows }: { rows: Array<{ label: string; value: number; hint?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span className="truncate text-fg-muted">{r.label}</span>
            <span className="font-mono text-xs text-fg-subtle tabular">
              {r.value}
              {r.hint && <span className="ml-2">{r.hint}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function TrendsPage() {
  const viewer = await getViewer();
  const [trends, companies, technologies, categories] = await Promise.all([
    listTrends(),
    topEntities("company", 24 * 7, 7),
    topEntities("technology", 24 * 7, 7),
    categoryCounts(24 * 7),
  ]);
  if (trends.length === 0) return <EmptyState title="No trends detected yet" description="Trends appear once enough related stories accumulate." />;
  const saved = viewer ? await bookmarkState(viewer.id, "trend", trends.map((t) => t.id)) : new Map();

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Trend engine"
        title="Macro trends"
        description="Detected by clustering related stories across sources and tracking their mention volume over time. Each trend lists its evidence, actors and implications."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {trends.map((t) => (
          <TrendCard key={t.id} trend={t} saved={saved.get(t.id)} />
        ))}
      </div>

      <section>
        <SectionHeader eyebrow="Analytics · last 7 days" title="What the ecosystem is talking about" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-fg">Most active companies</p>
            <BarList rows={companies.map((c) => ({ label: c.name, value: c.mentions, hint: `avg ${c.avgScore}` }))} />
          </Card>
          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-fg">Most discussed technologies</p>
            <BarList rows={technologies.map((c) => ({ label: c.name, value: c.mentions, hint: `avg ${c.avgScore}` }))} />
          </Card>
          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-fg">Coverage by category</p>
            <BarList rows={categories.map((c) => ({ label: c.category ? CATEGORY_LABELS[c.category] : "Uncategorized", value: c.count }))} />
          </Card>
        </div>
      </section>
    </div>
  );
}
