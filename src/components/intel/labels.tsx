import { BadgeCheck, Brain, Flame, HelpCircle, Lightbulb, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SKILL_STATUS_META } from "@/domain/skills";
import type { ClaimLabel as ClaimLabelType, Confidence, Difficulty, SkillStatus, TrendStatus } from "@/domain/taxonomy";

const claimMeta: Record<ClaimLabelType, { label: string; tone: BadgeTone; Icon: typeof BadgeCheck }> = {
  fact: { label: "Fact", tone: "fact", Icon: BadgeCheck },
  analysis: { label: "Analysis", tone: "analysis", Icon: Brain },
  speculation: { label: "Speculation", tone: "speculation", Icon: Lightbulb },
};

export function ClaimLabel({ label }: { label: ClaimLabelType }) {
  const { label: text, tone, Icon } = claimMeta[label];
  return (
    <Badge tone={tone} className="uppercase tracking-wide">
      <Icon aria-hidden />
      {text}
    </Badge>
  );
}

const statusIcon: Record<SkillStatus, typeof Flame> = {
  exploding: Flame,
  growing: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
  insufficient: HelpCircle,
};

export function MomentumBadge({ status }: { status: SkillStatus }) {
  const meta = SKILL_STATUS_META[status];
  const Icon = statusIcon[status];
  return (
    <Badge tone={meta.tone as BadgeTone}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );
}

const trendTone: Record<TrendStatus, BadgeTone> = { emerging: "accent", accelerating: "hot", mainstream: "up", cooling: "neutral" };

export function TrendStatusBadge({ status }: { status: TrendStatus }) {
  return (
    <Badge tone={trendTone[status]} className="capitalize">
      {status}
    </Badge>
  );
}

const difficultyTone: Record<Difficulty, BadgeTone> = { beginner: "up", intermediate: "accent", advanced: "hot", research: "analysis" };

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge tone={difficultyTone[difficulty]} className="capitalize">
      {difficulty}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "high") return null;
  return <Badge tone={confidence === "low" ? "warn" : "neutral"}>{confidence} confidence</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="warn" title="Seeded demo intelligence — publication time is simulated">
      DEMO
    </Badge>
  );
}
