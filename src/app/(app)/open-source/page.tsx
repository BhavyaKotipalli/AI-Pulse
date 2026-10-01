import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Flame, Star } from "lucide-react";
import { Sparkline } from "@/components/intel/sparkline";
import { EmptyState, PageHeader, SectionHeader } from "@/components/intel/section-header";
import { BookmarkButton } from "@/components/intel/bookmark-button";
import { ScoreBadge } from "@/components/intel/score-badge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { compactNumber } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { listTrendingRepos } from "@/server/repositories/items";
import { bookmarkState } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Open-source radar" };

export default async function OpenSourcePage() {
  const viewer = await getViewer();
  const repos = await listTrendingRepos(30);
  if (repos.length === 0) return <EmptyState title="No repositories tracked yet" description="GitHub ingestion arrives in Phase 2." />;
  const saved = viewer ? await bookmarkState(viewer.id, "item", repos.map((r) => r.id)) : new Map();
  const maxGrowth = Math.max(...repos.map((r) => r.metrics.starsDelta7d ?? 0));
  const hot = repos.filter((r) => (r.metrics.starsDelta7d ?? 0) >= maxGrowth * 0.75);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Open-source radar"
        title="What developers are building with"
        description="Repositories ranked by 7-day star growth, with the reason they're being discussed and projects you could build on them."
      />

      <section>
        <SectionHeader eyebrow="🔥 Rapidly trending" title="Fastest-growing this week" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hot.map((r) => (
            <Card key={r.id} interactive className="relative p-5">
              <div className="flex items-center gap-2">
                <Badge tone="hot">
                  <Flame /> +{compactNumber(r.metrics.starsDelta7d ?? 0)} this week
                </Badge>
                <span className="ml-auto text-xs text-fg-subtle">{r.metrics.language}</span>
              </div>
              <Link href={`/intel/${r.id}`} className="mt-3 block font-mono text-[15px] text-fg after:absolute after:inset-0">
                {r.title}
              </Link>
              <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{r.tldr}</p>
              <Sparkline values={r.history} width={260} height={36} tone="up" className="mt-4 w-full" label="Star history, last 14 days" />
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="All tracked repositories" />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="px-5 py-3 font-normal">Repository</th>
                <th className="px-3 py-3 font-normal">Category</th>
                <th className="px-3 py-3 font-normal">Language</th>
                <th className="px-3 py-3 text-right font-normal">Stars</th>
                <th className="px-3 py-3 text-right font-normal">7d growth</th>
                <th className="px-3 py-3 font-normal">14d</th>
                <th className="px-3 py-3 font-normal">Score</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {repos.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-2/50">
                  <td className="max-w-xs px-5 py-3">
                    <Link href={`/intel/${r.id}`} className="font-mono text-[13px] text-fg hover:underline">
                      {r.title}
                    </Link>
                    <p className="truncate text-xs text-fg-subtle">{r.tldr}</p>
                  </td>
                  <td className="px-3 py-3 text-xs capitalize text-fg-muted">{r.category?.replace("-", " ")}</td>
                  <td className="px-3 py-3 text-xs text-fg-muted">{r.metrics.language}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular text-fg">
                    <Star className="mr-1 inline size-3 text-fg-subtle" aria-hidden />
                    {compactNumber(r.metrics.stars ?? 0)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular text-up">+{compactNumber(r.metrics.starsDelta7d ?? 0)}</td>
                  <td className="px-3 py-3">
                    <Sparkline values={r.history} width={64} height={20} tone="up" />
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBadge score={r.score} breakdown={r.scoreBreakdown} size="sm" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <BookmarkButton targetType="item" targetId={r.id} saved={saved.get(r.id)} defaultCollection="tools" />
                      <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.title} on GitHub`} className="inline-flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg">
                        <ArrowUpRight className="size-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
