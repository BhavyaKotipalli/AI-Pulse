"use client";

import { DIMENSION_LABELS, SCORE_DIMENSIONS, SCORE_WEIGHTS, scoreBand, type ScoreBreakdown } from "@/domain/scoring";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const bandStyles = {
  critical: "text-hot border-hot/35 bg-hot/10",
  high: "text-accent-strong border-accent/35 bg-accent-soft",
  notable: "text-fg border-line-strong bg-surface-3",
  low: "text-fg-subtle border-line bg-surface-2",
} as const;

export function ScoreBadge({ score, breakdown, size = "md" }: { score: number; breakdown?: ScoreBreakdown | null; size?: "sm" | "md" }) {
  const band = scoreBand(score);
  const badge = (
    <span
      tabIndex={breakdown ? 0 : undefined}
      aria-label={`Intelligence score ${score} of 100`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-mono font-semibold tabular",
        size === "sm" ? "h-6 min-w-8 px-1.5 text-[11px]" : "h-7 min-w-10 px-2 text-xs",
        bandStyles[band],
      )}
    >
      {score}
    </span>
  );
  if (!breakdown) return badge;
  return (
    <Tooltip
      content={
        <div className="w-60 space-y-2">
          <div className="flex items-center justify-between text-fg">
            <span className="font-medium">
              Intelligence score
              {breakdown.method === "heuristic" && <span className="ml-1.5 text-[10px] font-normal text-warn">heuristic</span>}
              {breakdown.method === "demo" && <span className="ml-1.5 text-[10px] font-normal text-warn">demo</span>}
            </span>
            <span className="font-mono">{breakdown.score}</span>
          </div>
          <ul className="space-y-1">
            {SCORE_DIMENSIONS.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span className="w-32 truncate">{DIMENSION_LABELS[d]}</span>
                <span className="h-1 flex-1 overflow-hidden rounded bg-surface-3">
                  <span className="block h-full rounded bg-accent/70" style={{ width: `${breakdown.dimensions[d]}%` }} />
                </span>
                <span className="w-7 text-right font-mono tabular">{breakdown.dimensions[d]}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-2 text-[11px] leading-relaxed text-fg-subtle">
            Weights {SCORE_DIMENSIONS.map((d) => Math.round(SCORE_WEIGHTS[d] * 100)).join("/")} · clickbait ×{breakdown.clickbaitPenalty} ·
            corroboration ×{breakdown.corroborationBonus}
            {breakdown.method === "heuristic" && " · Sub-scores estimated by rules (no AI model configured)."}
          </p>
        </div>
      }
    >
      {badge}
    </Tooltip>
  );
}
