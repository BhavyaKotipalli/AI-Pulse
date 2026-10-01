import Link from "next/link";
import { ArrowRight, MessageSquareText, Sunrise } from "lucide-react";
import { ExperimentCard, PaperRow, RepoRow, SkillRow, StartupCard, Timeline, TrendCard } from "@/components/intel/cards";
import { ClaimLabel } from "@/components/intel/labels";
import { EmptyState, SectionHeader } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { getLatestBriefing, hydrateBriefing, listExperiments, listStartups, listTrends, skillRadar } from "@/server/repositories/intel";
import { listItems, listTrendingRepos, timeline } from "@/server/repositories/items";
import { bookmarkState } from "@/server/repositories/user-data";

export default async function OverviewPage() {
  const viewer = await getViewer();
  const [briefing, stories, trends, papers, skills, experiments, repos, startups, days] = await Promise.all([
    getLatestBriefing(),
    listItems({ kinds: ["article", "launch"], sinceHours: 72, limit: 6 }),
    listTrends(4),
    listItems({ kinds: ["paper"], limit: 3 }),
    skillRadar(),
    listExperiments(1),
    listTrendingRepos(5),
    listStartups(4),
    timeline(5, 2),
  ]);

  if (stories.length === 0 && !briefing) {
    return (
      <EmptyState title="No intelligence yet" description="Run `npm run setup` to load the demo dataset, or start ingestion once Phase 2 connectors are configured." />
    );
  }

  const briefingItems = briefing ? await hydrateBriefing(briefing.content) : new Map();
  const headline = briefing ? briefingItems.get(briefing.content.headline.itemId) : undefined;
  const [savedItems, savedTrends] = viewer
    ? await Promise.all([
        bookmarkState(viewer.id, "item", stories.map((s) => s.id)),
        bookmarkState(viewer.id, "trend", trends.map((t) => t.id)),
      ])
    : [new Map(), new Map()];
  const featuredExperiment = experiments[0];

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative -mx-4 -mt-8 overflow-hidden px-4 pb-4 pt-12 sm:-mx-6 sm:px-6 lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-16">
        <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="hairline-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative max-w-3xl animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface-1/70 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            <span className="size-1.5 animate-pulse-ring rounded-full bg-up" />
            {formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-balance text-[clamp(2.25rem,5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-fg">
            Understand AI before everyone else
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-[17px] leading-relaxed text-fg-muted">
            Your personal intelligence system for AI, research, technology, careers and emerging trends — ranked by signal, explained, and
            turned into action.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/today">
                <Sunrise />
                Read today&apos;s briefing
                <span className="font-mono text-xs opacity-60">{briefing?.content.readingMinutes ?? 5} min</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/ask">
                <MessageSquareText />
                Ask AI Pulse
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Today's intelligence */}
      {briefing && headline && (
        <section aria-labelledby="todays-intel">
          <SectionHeader eyebrow="Today's intelligence" title="The biggest development today" href="/today" hrefLabel="Full briefing" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <StoryCard item={headline} variant="feature" saved={savedItems.get(headline.id)} />
            <Card className="p-5">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">What to pay attention to</p>
              <ul className="space-y-4">
                {briefing.content.payAttention.map((b, i) => (
                  <li key={i} className="space-y-1.5">
                    <ClaimLabel label={b.label} />
                    <p className="text-sm leading-relaxed text-fg-muted">{b.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      )}

      {/* Top stories */}
      <section aria-labelledby="top-stories">
        <SectionHeader eyebrow="Ranked by intelligence score" title="Top stories" description="Last 72 hours. Clickbait and single-source hype are down-ranked." href="/for-you" hrefLabel="For you" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {stories.map((s, i) => (
            <StoryCard key={s.id} item={s} rank={i + 1} saved={savedItems.get(s.id)} />
          ))}
        </div>
      </section>

      {/* Trend radar */}
      <section>
        <SectionHeader eyebrow="Trend engine" title="Trend radar" description="Patterns detected across many stories, not single headlines." href="/trends" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {trends.map((t) => (
            <TrendCard key={t.id} trend={t} saved={savedTrends.get(t.id)} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Research radar */}
        <section>
          <SectionHeader eyebrow="Research radar" title="Papers worth your time" href="/research" />
          <Card>
            <ul className="divide-y divide-line">
              {papers.map((p) => (
                <PaperRow key={p.id} paper={p} />
              ))}
            </ul>
          </Card>
        </section>

        {/* Career impact */}
        <section>
          <SectionHeader eyebrow="Career impact" title="Skill radar" description="Momentum from evidence counts, last 30 vs prior 30 days." href="/career" />
          <Card className="px-5 py-2">
            <ul className="divide-y divide-line">
              {skills.slice(0, 6).map((s) => (
                <SkillRow key={s.id} skill={s} />
              ))}
            </ul>
          </Card>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Experiment of the day */}
        {featuredExperiment && (
          <section>
            <SectionHeader eyebrow="Experiment lab" title="Experiment of the day" href="/experiments" />
            <ExperimentCard exp={featuredExperiment} featured />
          </section>
        )}

        {/* Open source */}
        <section>
          <SectionHeader eyebrow="Open-source radar" title="Rapidly trending repositories" href="/open-source" />
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {repos.map((r, i) => (
                <RepoRow key={r.id} repo={r} rank={i + 1} />
              ))}
            </ul>
          </Card>
        </section>
      </div>

      {/* Startups */}
      <section>
        <SectionHeader eyebrow="Startup radar" title="Startups to watch" href="/startups" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {startups.map((s) => (
            <StartupCard key={s.slug} startup={s} />
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section>
        <SectionHeader eyebrow="Knowledge timeline" title="How the week unfolded" />
        <Card className="p-6">
          <Timeline days={days} />
          <Link href="/trends" className="mt-6 inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
            Zoom out to trends <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      </section>
    </div>
  );
}
