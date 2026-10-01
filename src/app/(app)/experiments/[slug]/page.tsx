import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Database, Layers, Target } from "lucide-react";
import { BookmarkButton } from "@/components/intel/bookmark-button";
import { DemoBadge, DifficultyBadge } from "@/components/intel/labels";
import { SectionHeader } from "@/components/intel/section-header";
import { StartExperimentButton } from "@/components/intel/start-experiment-button";
import { StoryCard } from "@/components/intel/story-card";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/server/auth/viewer";
import { getExperiment } from "@/server/repositories/intel";
import { bookmarkState } from "@/server/repositories/user-data";

export async function generateMetadata({ params }: PageProps<"/experiments/[slug]">): Promise<Metadata> {
  const data = await getExperiment((await params).slug);
  return { title: data?.experiment.title ?? "Experiment" };
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-1 font-mono text-lg text-fg tabular">
        {value}
        <span className="text-sm text-fg-subtle">/5</span>
      </p>
    </div>
  );
}

export default async function ExperimentPage({ params }: PageProps<"/experiments/[slug]">) {
  const { slug } = await params;
  const data = await getExperiment(slug);
  if (!data) notFound();
  const { experiment: e, sources, trend } = data;
  const viewer = await getViewer();
  const saved = viewer ? await bookmarkState(viewer.id, "experiment", [e.id]) : new Map();
  const collections = saved.get(e.id) ?? [];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/experiments" className="text-[13px] text-fg-subtle hover:text-fg">
            Experiment lab
          </Link>
          <span className="text-fg-subtle">/</span>
          <DifficultyBadge difficulty={e.difficulty} />
          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
            <Clock className="size-3" /> {e.timeEstimate}
          </span>
          {e.isDemo && <DemoBadge />}
        </div>
        <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.025em] text-fg">{e.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-fg-muted">{e.summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <StartExperimentButton experimentId={e.id} skills={e.skills} started={collections.includes("project_ideas")} />
          <BookmarkButton targetType="experiment" targetId={e.id} saved={collections} defaultCollection="project_ideas" />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="space-y-5 p-6">
          <div>
            <p className="mb-1 text-sm font-medium text-fg">Why it&apos;s interesting</p>
            <p className="text-[15px] leading-relaxed text-fg-muted">{e.whyInteresting}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-2 text-sm font-medium text-fg">
              <Layers className="size-4 text-fg-subtle" /> Architecture
            </p>
            <p className="text-[15px] leading-relaxed text-fg-muted">{e.architecture}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-2 text-sm font-medium text-fg">
              <Database className="size-4 text-fg-subtle" /> Dataset / API requirements
            </p>
            <p className="text-[15px] leading-relaxed text-fg-muted">{e.dataRequirements}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-2 text-sm font-medium text-fg">
              <Target className="size-4 text-fg-subtle" /> Expected result
            </p>
            <p className="text-[15px] leading-relaxed text-fg-muted">{e.expectedResult}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="grid grid-cols-3 gap-4 p-5">
            <Rating label="GitHub potential" value={e.githubPotential} />
            <Rating label="Resume value" value={e.resumeValue} />
            <Rating label="Startup potential" value={e.startupPotential} />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-sm font-medium text-fg">Skills you&apos;ll learn</p>
            <div className="flex flex-wrap gap-1.5">
              {e.skills.map((s) => (
                <span key={s} className="rounded-md border border-accent/25 bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                  {s}
                </span>
              ))}
            </div>
            <p className="mb-2 mt-4 text-sm font-medium text-fg">Technologies</p>
            <ul className="space-y-1 text-sm text-fg-muted">
              {e.technologies.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </Card>
          {trend && (
            <Card className="p-5">
              <p className="text-xs text-fg-subtle">Part of trend</p>
              <Link href={`/trends/${trend.slug}`} className="mt-1 block text-sm font-medium text-fg hover:underline">
                {trend.title}
              </Link>
            </Card>
          )}
        </div>
      </div>

      <section>
        <SectionHeader eyebrow="Implementation plan" title="Step by step" />
        <ol className="space-y-3">
          {e.steps.map((step, i) => (
            <li key={i} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface-1 p-5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-3 font-mono text-xs text-fg">
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-medium text-fg">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {sources.length > 0 && (
        <section>
          <SectionHeader eyebrow="Inspired by" title="Source intelligence" />
          <div className="grid gap-3 md:grid-cols-2">
            {sources.map((s) => (
              <StoryCard key={s.id} item={s} variant="compact" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
