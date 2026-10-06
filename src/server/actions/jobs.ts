"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { getViewer } from "@/server/auth/viewer";
import { JOBS } from "@/server/jobs";

/** Admins are signed-in users listed in ADMIN_EMAILS. In development any signed-in user may run jobs. */
export async function canRunJobs(): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || !viewer.email) return false;
  const e = env();
  if (e.NODE_ENV !== "production") return true;
  return e.ADMIN_EMAILS.includes(viewer.email.toLowerCase());
}

const Input = z.enum(["ingest", "enrich", "insights", "daily"]);

export async function triggerJob(raw: string): Promise<{ ok: boolean; message: string }> {
  const job = Input.safeParse(raw);
  if (!job.success) return { ok: false, message: "Unknown job" };
  if (!(await canRunJobs())) return { ok: false, message: "Only admins can run jobs" };
  const result = await JOBS[job.data]();
  revalidatePath("/", "layout");
  if (result.status === "skipped") return { ok: false, message: "Already running — try again in a few minutes." };
  if (result.status === "failed") return { ok: false, message: `Failed: ${result.error ?? "unknown error"}` };
  const s = result.stats as { inserted?: number; durationMs?: number };
  const stats = result.stats as Record<string, unknown>;
  const seconds = Math.round((s.durationMs ?? 0) / 1000);
  const summary: Record<string, string> = {
    ingest: `Ingested ${s.inserted ?? 0} new items in ${seconds}s.`,
    enrich: stats.skipped
      ? String(stats.skipped)
      : `Classified ${stats.classified ?? 0}, analyzed ${stats.analyzed ?? 0}, re-embedded ${stats.reembedded ?? 0}${stats.stopped ? ` — paused: ${stats.stopped}` : ""}${stats.pendingClassification ? ` (${stats.pendingClassification} still pending — run again)` : ""}.`,
    insights: `Trends found: ${stats.trendsDiscovered ?? 0}, experiments: ${stats.experimentsGenerated ?? 0}, role analyses: ${stats.careerImpactsGenerated ?? 0}, weekly report: ${stats.weekly ?? "n/a"}${stats.stopped ? ` — paused: ${stats.stopped}` : ""}.`,
    daily: "Rescored, refreshed skills and rebuilt today's briefing.",
  };
  return { ok: true, message: summary[job.data] ?? "Done." };
}
