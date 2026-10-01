import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowRight } from "lucide-react";
import { MentionsChart } from "@/components/charts/mentions-chart";
import { ChangePill, ExperimentCard } from "@/components/intel/cards";
import { ClaimLabel, ConfidenceBadge, DemoBadge, TrendStatusBadge } from "@/components/intel/labels";
import { SectionHeader } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { BookmarkButton } from "@/components/intel/bookmark-button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS, type EntityType } from "@/domain/taxonomy";
import { formatDate, titleCase } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { getTrend } from "@/server/repositories/intel";
import { bookmarkState } from "@/server/repositories/user-data";

export async function generateMetadata({ params }: PageProps<"/trends/[slug]">): Promise<Metadata> {
  const data = await getTrend((await params).slug);
  return { title: data?.trend.title ?? "Trend" };
}

export default async function TrendPage({ params }: PageProps<"/trends/[slug]">) {
  const { slug } = await params;
  const data = await getTrend(slug);
  if (!data) notFound();
  const { trend, items, entities, series, impacts, experiments } = data;
  const viewer = await getViewer();
  const saved = viewer ? await bookmarkState(viewer.id, "trend", [trend.id]) : new Map();

  const byType = new Map<EntityType, typeof entities>();
  for (const e of entities) byType.set(e.type, [...(byType.get(e.type) ?? []), e]);
  const sum = (arr: typeof series) => arr.reduce((s, p) => s + p.mentions, 0);
  const change = series.length >= 60 ? Math.round(((sum(series.slice(-30)) - sum(series.slice(-60, -30))) / Math.max(1, sum(series.slice(-60, -30)))) * 100) : null;

  return (
    <div className="space-y-12">
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/trends" className="text-[13px] text-fg-subtle hover:text-fg">
            Trends
          </Link>
          <span className="text-fg-subtle">/</span>
          <TrendStatusBadge status={trend.status} />
          {trend.isDemo && <DemoBadge curated />}
          <span className="text-xs text-fg-subtle">First seen {formatDate(trend.firstSeenAt, { month: "short", day: "numeric", year: "numeric" })}</span>
          <BookmarkButton targetType="trend" targetId={trend.id} saved={saved.get(trend.id)} defaultCollection="research" className="ml-auto" />
        </div>
        <h1 className="max-w-3xl text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-fg">{trend.title}</h1>
        <p className="mt-3 max-w-3xl text-pretty text-lg leading-relaxed text-fg-muted">{trend.thesis}</p>
      </header>

      {/* Chain */}
      {trend.chain.length > 0 && (
        <section aria-label="Trend chain">
          <SectionHeader eyebrow="Trend graph" title="How it propagates" />
          <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {trend.chain.map((node, i) => (
              <li key={node} className="flex flex-col items-center gap-2 md:flex-1 md:flex-row">
                <span className="w-full rounded-xl border border-line bg-surface-1 px-4 py-3 text-center text-sm font-medium text-fg md:flex-1">{node}</span>
                {i < trend.chain.length - 1 && (
                  <>
                    <ArrowDown className="size-4 text-fg-subtle md:hidden" aria-hidden />
                    <ArrowRight className="hidden size-4 shrink-0 text-fg-subtle md:block" aria-hidden />
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-fg">Mentions · 90 days</p>
            <span className="text-xs text-fg-subtle">
              30d change <ChangePill value={change} />
            </span>
          </div>
          <MentionsChart data={series} />
        </Card>
        <Card className="space-y-4 p-5">
          <div>
            <p className="mb-1 text-sm font-medium text-fg">Why this is happening</p>
            <p className="text-sm leading-relaxed text-fg-muted">{trend.whyHappening}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Who it affects</p>
            <div className="flex flex-wrap gap-1.5">
              {trend.affectedRoles.map((r) => (
                <span key={r} className="rounded-md bg-surface-3/70 px-2 py-0.5 text-xs text-fg-muted">
                  {ROLE_LABELS[r]}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Skills becoming important</p>
            <div className="flex flex-wrap gap-1.5">
              {trend.skills.map((s) => (
                <span key={s} className="rounded-md border border-accent/25 bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <section>
        <SectionHeader eyebrow="Implications" title="What it means" description="Facts are sourced; analysis and speculation are labeled as such." />
        <Card className="divide-y divide-line">
          {trend.implications.map((claim, i) => (
            <div key={i} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex w-36 shrink-0 flex-wrap gap-1.5">
                <ClaimLabel label={claim.label} />
                <ConfidenceBadge confidence={claim.confidence} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] leading-relaxed text-fg">{claim.text}</p>
                <p className="mt-1.5 text-xs text-fg-subtle">
                  {claim.sourceItemIds.length === 0
                    ? "No direct source — forward-looking analysis."
                    : `Supported by ${claim.sourceItemIds.length} source${claim.sourceItemIds.length > 1 ? "s" : ""} listed below.`}
                </p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeader eyebrow="Actors" title="Companies & technologies involved" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...byType.entries()].map(([type, list]) => (
            <Card key={type} className="p-5">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">{titleCase(type)}s</p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((e) => (
                  <Link
                    key={e.id}
                    href={type === "startup" ? `/startups/${e.slug}` : `/search?q=${encodeURIComponent(e.name)}`}
                    className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                  >
                    {e.name}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Evidence" title={`${items.length} supporting sources`} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((it) => (
            <StoryCard key={it.id} item={it} variant="compact" />
          ))}
        </div>
      </section>

      {impacts.length > 0 && (
        <section>
          <SectionHeader eyebrow="Career impact" title="How roles change" href="/career" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {impacts.map((imp) => (
              <Card key={imp.id} className="p-5">
                <p className="text-sm font-medium text-fg">{ROLE_LABELS[imp.role]}</p>
                <p className="mt-1 text-sm text-fg-muted">{imp.headline}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {experiments.length > 0 && (
        <section>
          <SectionHeader eyebrow="Act on it" title="Experiments from this trend" href="/experiments" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {experiments.map((e) => (
              <ExperimentCard key={e.id} exp={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
