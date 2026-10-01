import type { Briefing } from "./analysis";
import type { Category, ItemKind, SkillStatus, TrendStatus } from "./taxonomy";

export interface BriefingCandidate {
  id: string;
  kind: ItemKind;
  title: string;
  tldr: string | null;
  whyItMatters: string | null;
  category: Category | null;
  score: number;
  starsDelta7d?: number;
}

export interface BriefingContext {
  items: BriefingCandidate[];
  totalItemsConsidered: number;
  trends: Array<{ slug: string; title: string; thesis: string; status: TrendStatus; momentum: number; evidenceItemIds: string[] }>;
  experimentSlug?: string;
  startupSlug?: string;
  skills: Array<{ name: string; status: SkillStatus; growth: number | null; evidenceItemIds: string[] }>;
  hourUtc?: number;
}

const WORDS_PER_MINUTE = 230;

/**
 * Deterministic daily briefing: selects and orders already-ranked intelligence into the
 * briefing sections. It writes no new claims — summaries come from source-derived TL;DRs
 * (labeled FACT) and from our own measured trend/skill data (labeled ANALYSIS).
 * An LLM-written briefing (Phase 9) replaces the connective prose, not the selection.
 */
export function composeBriefing(ctx: BriefingContext): Briefing | null {
  const ranked = [...ctx.items].sort((a, b) => b.score - a.score);
  const stories = ranked.filter((i) => i.kind === "article" || i.kind === "launch");
  const headline = stories[0];
  if (!headline) return null;

  const top = stories.slice(1, 6);
  const research = ranked.find((i) => i.kind === "paper");
  const tool = ranked.find((i) => i.kind === "tool" || (i.kind === "launch" && i.id !== headline.id && !top.some((t) => t.id === i.id)));
  const repo = [...ranked].filter((i) => i.kind === "repo").sort((a, b) => (b.starsDelta7d ?? 0) - (a.starsDelta7d ?? 0))[0];

  const careerItems = ranked.filter((i) => i.category === "careers" && i.tldr).slice(0, 2);
  const jobs: Briefing["jobs"] = careerItems.map((i) => ({ text: i.tldr!, label: "fact", sourceItemIds: [i.id] }));
  const risingSkills = ctx.skills.filter((s) => s.status === "exploding" || s.status === "growing").slice(0, 2);
  for (const s of risingSkills) {
    jobs.push({
      text: `Evidence for ${s.name} is ${s.status} — mentions ${s.growth !== null ? `${s.growth >= 0 ? "+" : ""}${Math.round(s.growth * 100)}%` : "up"} over the last 30 days versus the prior 30.`,
      label: "analysis",
      sourceItemIds: s.evidenceItemIds.slice(0, 3),
    });
  }

  const byMomentum = [...ctx.trends].sort((a, b) => b.momentum - a.momentum);
  const emerging = byMomentum.find((t) => t.status === "emerging");
  const payAttention: Briefing["payAttention"] = byMomentum
    .filter((t) => t.slug !== emerging?.slug)
    .slice(0, 3)
    .map((t) => ({ text: `${t.title}: ${t.thesis}`, label: "analysis", sourceItemIds: t.evidenceItemIds.slice(0, 3) }));

  const skill = ctx.skills.find((s) => s.status === "exploding") ?? ctx.skills.find((s) => s.status === "growing");

  const included = [headline, ...top, research, tool, repo].filter(Boolean) as BriefingCandidate[];
  const words =
    included.reduce((n, i) => n + i.title.split(" ").length + (i.tldr?.split(" ").length ?? 0), 0) +
    [...jobs, ...payAttention].reduce((n, b) => n + b.text.split(" ").length, 0);

  const hour = ctx.hourUtc ?? new Date().getUTCHours();
  return {
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    headline: {
      itemId: headline.id,
      // Empty when the source provided no excerpt — the UI then shows the title alone rather than repeating it.
      summary: headline.tldr ?? "",
      whyItMatters:
        headline.whyItMatters ??
        `Ranked #1 of ${ctx.totalItemsConsidered} items collected in this window by intelligence score (impact, novelty, credibility, momentum, recency).`,
    },
    topStoryIds: top.map((t) => t.id),
    researchItemId: research?.id,
    toolItemId: tool?.id,
    repoItemId: repo?.id,
    jobs,
    startupSlug: ctx.startupSlug,
    experimentSlug: ctx.experimentSlug,
    skill: skill ? { name: skill.name, reason: `Its evidence count is ${skill.status} in tracked sources over the last 30 days.` } : undefined,
    emergingTrendSlug: emerging?.slug,
    payAttention,
    readingMinutes: Math.max(3, Math.round(words / WORDS_PER_MINUTE) + 2),
  };
}
