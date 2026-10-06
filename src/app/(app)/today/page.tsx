import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExperimentCard, StartupCard } from "@/components/intel/cards";
import { ClaimLabel, DemoBadge } from "@/components/intel/labels";
import { EmptyState } from "@/components/intel/section-header";
import { SourceLine, StoryCard } from "@/components/intel/story-card";
import { Card } from "@/components/ui/card";
import type { Briefing } from "@/domain/analysis";
import { formatDate } from "@/lib/utils";
import { getExperiment, getLatestBriefing, getStartup, getTrend, hydrateBriefing } from "@/server/repositories/intel";
import type { ItemSummary } from "@/server/repositories/items";

export const metadata: Metadata = { title: "Today's briefing" };

function Section({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="mb-4 flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-fg">
        <span aria-hidden className="text-lg">
          {emoji}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Citations({ ids, items }: { ids: string[]; items: Map<string, ItemSummary> }) {
  const list = ids.map((id) => items.get(id)).filter((i): i is ItemSummary => Boolean(i));
  if (list.length === 0) return <span className="text-xs text-fg-subtle">No source — treat as opinion.</span>;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {list.map((i, idx) => (
        <Link
          key={i.id}
          href={`/intel/${i.id}`}
          title={i.title}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          <span className="font-mono text-accent">[{idx + 1}]</span>
          {i.sourceName}
        </Link>
      ))}
    </span>
  );
}

function Bullets({ list, items }: { list: Briefing["jobs"]; items: Map<string, ItemSummary> }) {
  return (
    <ul className="space-y-4">
      {list.map((b, i) => (
        <li key={i} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div className="w-28 shrink-0 pt-0.5">
            <ClaimLabel label={b.label} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[15px] leading-relaxed text-fg-muted">{b.text}</p>
            <Citations ids={b.sourceItemIds} items={items} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ViewTabs({ weekly }: { weekly: boolean }) {
  const tab = (href: "/today" | "/today?view=weekly", label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[13px] text-accent-strong"
          : "rounded-full border border-line px-3.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      }
    >
      {label}
    </Link>
  );
  return (
    <nav className="mb-6 flex gap-2" aria-label="Briefing period">
      {tab("/today", "Daily briefing", !weekly)}
      {tab("/today?view=weekly", "Weekly report", weekly)}
    </nav>
  );
}

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const weekly = (await searchParams).view === "weekly";
  const briefing = await getLatestBriefing(weekly ? "weekly" : "daily");
  if (!briefing) {
    return (
      <div className="mx-auto max-w-3xl">
        <ViewTabs weekly={weekly} />
        <EmptyState
          title={weekly ? "No weekly report yet" : "No briefing yet"}
          description={
            weekly
              ? "The State of AI — This Week is built once enough stories have been collected over the week."
              : "The daily briefing is generated each morning after ingestion."
          }
        />
      </div>
    );
  }
  const c = briefing.content;
  const items = await hydrateBriefing(c);
  const [experiment, startup, trend] = await Promise.all([
    c.experimentSlug ? getExperiment(c.experimentSlug) : null,
    c.startupSlug ? getStartup(c.startupSlug) : null,
    c.emergingTrendSlug ? getTrend(c.emergingTrendSlug) : null,
  ]);
  const headline = items.get(c.headline.itemId);
  const top = c.topStoryIds.map((id) => items.get(id)).filter((i): i is ItemSummary => Boolean(i));
  const research = c.researchItemId ? items.get(c.researchItemId) : undefined;
  const tool = c.toolItemId ? items.get(c.toolItemId) : undefined;
  const repo = c.repoItemId ? items.get(c.repoItemId) : undefined;

  return (
    <article className="mx-auto max-w-3xl">
      <ViewTabs weekly={weekly} />
      <header className="relative mb-10 overflow-hidden rounded-2xl border border-line p-8">
        <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            AI Pulse · {formatDate(`${briefing.date}T12:00:00Z`, { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-fg">{c.title ?? `${c.greeting} 👋`}</h1>
          <p className="mt-2 text-[15px] text-fg-muted">
            {weekly ? "The week in review." : `Your ${c.readingMinutes}-minute briefing.`} Every claim is labeled and linked to its sources.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-fg-subtle">
            <span>Generated by {briefing.model}</span>
            {briefing.isDemo && <DemoBadge />}
          </div>
        </div>
      </header>

      <div className="space-y-10">
        {c.overview && c.overview.length > 0 && (
          <Section emoji="🧭" title={weekly ? "The week at a glance" : "Today at a glance"}>
            <Bullets list={c.overview} items={items} />
          </Section>
        )}
        {headline && (
          <Section emoji="🚨" title={weekly ? "Biggest development this week" : "Biggest AI development today"}>
            <Card className="p-6">
              <SourceLine item={headline} />
              <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-fg">
                <Link href={`/intel/${headline.id}`} className="hover:underline">
                  {headline.title}
                </Link>
              </h3>
              {c.headline.summary && (
                <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
                  <ClaimLabel label="fact" /> <span className="ml-1">{c.headline.summary}</span>
                </p>
              )}
              <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
                <ClaimLabel label="analysis" /> <span className="ml-1">{c.headline.whyItMatters}</span>
              </p>
            </Card>
          </Section>
        )}

        <Section emoji="🔥" title="Top 5 AI stories">
          <div className="space-y-3">
            {top.map((s, i) => (
              <StoryCard key={s.id} item={s} rank={i + 1} />
            ))}
          </div>
        </Section>

        {research && (
          <Section emoji="🧠" title="Research breakthrough">
            <StoryCard item={research} variant="feature" />
          </Section>
        )}

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          {tool && (
            <Section emoji="🛠" title="Tool worth trying">
              <StoryCard item={tool} />
            </Section>
          )}
          {repo && (
            <Section emoji="📦" title="Trending open source">
              <StoryCard item={repo} />
            </Section>
          )}
        </div>

        <Section emoji="💼" title="AI & jobs">
          <Bullets list={c.jobs} items={items} />
        </Section>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          {startup && (
            <Section emoji="🚀" title="Startup to watch">
              <StartupCard startup={startup} />
            </Section>
          )}
          {experiment && (
            <Section emoji="🧪" title="Experiment of the day">
              <ExperimentCard exp={experiment.experiment} />
            </Section>
          )}
        </div>

        {c.skill && (
          <Section emoji="🎯" title="Skill worth learning">
            <Card className="p-5">
              <p className="text-[15px] font-medium text-fg">{c.skill.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{c.skill.reason}</p>
              <Link href="/career" className="mt-3 inline-block text-[13px] text-accent hover:underline">
                See the skill radar →
              </Link>
            </Card>
          </Section>
        )}

        {trend && (
          <Section emoji="🔮" title="Emerging trend">
            <Card className="p-5">
              <Link href={`/trends/${trend.trend.slug}`} className="text-[15px] font-medium text-fg hover:underline">
                {trend.trend.title}
              </Link>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{trend.trend.thesis}</p>
            </Card>
          </Section>
        )}

        <Section emoji="📌" title="What you should pay attention to">
          <Bullets list={c.payAttention} items={items} />
        </Section>
      </div>
    </article>
  );
}
