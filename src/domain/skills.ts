import type { SkillStatus } from "./taxonomy";

export const MIN_EVIDENCE_FOR_STATUS = 5;

/**
 * Skill momentum is derived from evidence counts — never asserted.
 * Compares mentions in the last 30 days against the previous 30 days.
 */
export function classifySkillMomentum(last30: number, prev30: number): {
  status: SkillStatus;
  growth: number | null;
} {
  if (last30 + prev30 < MIN_EVIDENCE_FOR_STATUS) return { status: "insufficient", growth: null };
  // Laplace smoothing so a jump from 0 isn't infinite growth.
  const growth = (last30 + 1) / (prev30 + 1) - 1;
  let status: SkillStatus;
  if (growth > 0.6) status = "exploding";
  else if (growth > 0.15) status = "growing";
  else if (growth >= -0.15) status = "stable";
  else status = "declining";
  return { status, growth: Number(growth.toFixed(3)) };
}

export const SKILL_STATUS_META: Record<SkillStatus, { label: string; tone: string }> = {
  exploding: { label: "Exploding", tone: "hot" },
  growing: { label: "Growing", tone: "up" },
  stable: { label: "Stable", tone: "neutral" },
  declining: { label: "Declining", tone: "down" },
  insufficient: { label: "Insufficient evidence", tone: "muted" },
};
