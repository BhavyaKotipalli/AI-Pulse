import Link from "next/link";
import { ArrowUpRight, Clock, FileText, GitFork, Star } from "lucide-react";
import type { Collection } from "@/domain/taxonomy";
import { cn, compactNumber, formatDate } from "@/lib/utils";
import type { ExperimentRow, SkillRadarRow, StartupRow, TrendSummary } from "@/server/repositories/intel";
import type { RepoWithHistory, TimelineDay } from "@/server/repositories/items";
import { BookmarkButton } from "./bookmark-button";
import { DemoBadge, DifficultyBadge, MomentumBadge, TrendStatusBadge } from "./labels";
import { ScoreBadge } from "./score-badge";
import { Sparkline } from "./sparkline";

export function ChangePill({ value }: { value: number | null }) {
  if (value === null) return <span className="font-mono text-xs text-fg-subtle">—</span>;
  const tone = value > 15 ? "text-up" : value < -15 ? "text-down" : "text-fg-muted";
  return (
    <span className={cn("font-mono text-xs tabular", tone)}>
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export function TrendCard({ trend, saved }: { trend: TrendSummary; saved?: Collection[] }) {
  return (
    <article className="group relative flex flex-col rounded-[var(--radius-card)] border border-line bg-surface-1 p-5 transition-colors hover:border-line-strong hover:bg-surface-2/50">
      <div className="flex items-center gap-2">
        <TrendStatusBadge status={trend.status} />
        {trend.isDemo && <DemoBadge curated />}
        <span className="ml-auto text-xs text-fg-subtle">{trend.evidenceCount} sources</span>
      </div>
      <h3 className="mt-3 text-[15px] font-medium leading-snug tracking-tight text-fg">
        <Link href={`/trends/${trend.slug}`} className="after:absolute after:inset-0">
          {trend.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">{trend.thesis}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-fg-subtle">30d mentions</p>
          <ChangePill value={trend.change30d} />
        </div>
        <Sparkline values={trend.series} width={120} height={30} tone={trend.momentum > 0.7 ? "hot" : "accent"} />
      </div>
      <div className="absolute right-3 top-12 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <BookmarkButton targetType="trend" targetId={trend.id} saved={saved} defaultCollection="research" />
      </div>
    </article>
  );
}

function Pips({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-fg-subtle">{label}</span>
      <span className="flex gap-0.5" aria-label={`${label}: ${value} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("h-1.5 w-3 rounded-sm", i <= value ? "bg-accent" : "bg-surface-3")} />
        ))}
      </span>
    </div>
  );
}

export function ExperimentCard({ exp, saved, featured }: { exp: ExperimentRow; saved?: Collection[]; featured?: boolean }) {
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-[var(--radius-card)] border border-line bg-surface-1 p-5 transition-colors hover:border-line-strong hover:bg-surface-2/50",
        featured && "bg-[linear-gradient(135deg,rgb(139_147_255/0.08),transparent_55%)]",
      )}
    >
      <div className="flex items-center gap-2">
        <DifficultyBadge difficulty={exp.difficulty} />
        <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
          <Clock className="size-3" aria-hidden />
          {exp.timeEstimate}
        </span>
        <BookmarkButton targetType="experiment" targetId={exp.id} saved={saved} defaultCollection="project_ideas" className="relative z-10 ml-auto" />
      </div>
      <h3 className={cn("mt-3 font-medium leading-snug tracking-tight text-fg", featured ? "text-lg" : "text-[15px]")}>
        <Link href={`/experiments/${exp.slug}`} className="after:absolute after:inset-0">
          {exp.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-fg-muted">{featured ? exp.whyInteresting : exp.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {exp.skills.slice(0, featured ? 4 : 3).map((s) => (
          <span key={s} className="rounded-md bg-surface-3/70 px-1.5 py-0.5 text-[11px] text-fg-muted">
            {s}
          </span>
        ))}
      </div>
      <div className="mt-auto space-y-1.5 pt-4">
        <Pips value={exp.resumeValue} label="Resume value" />
        <Pips value={exp.githubPotential} label="GitHub potential" />
        {featured && <Pips value={exp.startupPotential} label="Startup potential" />}
      </div>
    </article>
  );
}

export function RepoRow({ repo, rank }: { repo: RepoWithHistory; rank?: number }) {
  return (
    <li className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2/50">
      {rank !== undefined && <span className="w-5 font-mono text-xs text-fg-subtle tabular">{rank}</span>}
      <GitFork className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      <div className="min-w-0 flex-1">
        <Link href={`/intel/${repo.id}`} className="block truncate font-mono text-[13px] text-fg after:absolute after:inset-0">
          {repo.title}
        </Link>
        <p className="truncate text-xs text-fg-subtle">{repo.tldr}</p>
      </div>
      <span className="hidden w-20 text-xs text-fg-subtle md:block">{repo.metrics.language}</span>
      <Sparkline values={repo.history} width={72} height={24} tone="up" className="hidden sm:block" label="Star history, last 14 days" />
      <div className="w-20 text-right">
        <p className="inline-flex items-center gap-1 font-mono text-xs text-fg tabular">
          <Star className="size-3 text-fg-subtle" aria-hidden />
          {compactNumber(repo.metrics.stars ?? 0)}
        </p>
        <p className="font-mono text-[11px] text-up tabular">+{compactNumber(repo.metrics.starsDelta7d ?? 0)}/wk</p>
      </div>
    </li>
  );
}

export function StartupCard({ startup, saved }: { startup: StartupRow; saved?: Collection[] }) {
  const p = startup.profile;
  return (
    <article className="group relative flex flex-col rounded-[var(--radius-card)] border border-line bg-surface-1 p-5 transition-colors hover:border-line-strong hover:bg-surface-2/50">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-3 text-sm font-semibold text-fg">
          {startup.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium text-fg">
            <Link href={`/startups/${startup.slug}`} className="after:absolute after:inset-0">
              {startup.name}
            </Link>
          </h3>
          <p className="truncate text-xs text-fg-subtle">{p.tagline}</p>
        </div>
        <BookmarkButton targetType="startup" targetId={startup.slug} saved={saved} defaultCollection="startups" className="relative z-10" />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-fg-muted">{p.interesting}</p>
      <div className="mt-auto flex items-center justify-between pt-4 text-xs">
        <span className="text-fg-subtle">{p.fundingStage ?? "Funding not verified"}</span>
        <span className="font-mono text-fg-muted tabular">momentum {p.momentum}</span>
      </div>
    </article>
  );
}

export function SkillRow({ skill }: { skill: SkillRadarRow }) {
  const tone = skill.status.status === "exploding" ? "hot" : skill.status.status === "growing" ? "up" : skill.status.status === "declining" ? "down" : "muted";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{skill.name}</p>
        <p className="text-[11px] text-fg-subtle">
          {skill.status.last30} mentions / 30d · {skill.status.evidenceItemIds.length} linked stories
        </p>
      </div>
      <Sparkline values={skill.series} width={64} height={22} tone={tone} label={`${skill.name} weekly mentions`} />
      <div className="w-28 text-right">
        <MomentumBadge status={skill.status.status} />
      </div>
    </li>
  );
}

export function Timeline({ days }: { days: TimelineDay[] }) {
  return (
    <ol className="relative space-y-6 border-l border-line pl-6">
      {days.map((day) => (
        <li key={day.date} className="relative">
          <span className="absolute -left-[29px] top-1 size-2.5 rounded-full border-2 border-bg bg-accent" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
            {formatDate(`${day.date}T12:00:00Z`, { weekday: "short", month: "short", day: "numeric" })}
          </p>
          <ul className="mt-2 space-y-1.5">
            {day.items.map((it) => (
              <li key={it.id} className="flex items-start gap-2">
                <ScoreBadge score={it.score} size="sm" />
                <Link href={`/intel/${it.id}`} className="pt-0.5 text-sm leading-snug text-fg-muted transition-colors hover:text-fg">
                  {it.title}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function PaperRow({ paper }: { paper: { id: string; title: string; author: string | null; tldr: string | null; score: number; url: string } }) {
  return (
    <li className="group relative flex gap-3 px-5 py-4 transition-colors hover:bg-surface-2/50">
      <FileText className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
      <div className="min-w-0 flex-1">
        <Link href={`/intel/${paper.id}`} className="line-clamp-2 text-sm font-medium leading-snug text-fg after:absolute after:inset-0">
          {paper.title}
        </Link>
        <p className="mt-0.5 truncate text-xs text-fg-subtle">{paper.author}</p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">{paper.tldr}</p>
      </div>
      <div className="relative z-10 flex flex-col items-end gap-2">
        <ScoreBadge score={paper.score} size="sm" />
        <a href={paper.url} target="_blank" rel="noreferrer" aria-label="Open on arXiv" className="text-fg-subtle hover:text-fg">
          <ArrowUpRight className="size-4" />
        </a>
      </div>
    </li>
  );
}
