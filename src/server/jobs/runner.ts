import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db/client";
import { jobRuns } from "@/server/db/schema";

export type JobName = "ingest" | "daily";

export interface JobResult {
  status: "succeeded" | "failed" | "skipped";
  runId: string | null;
  stats: Record<string, unknown>;
  error?: string;
}

const STALE_LOCK_MS = 30 * 60_000;

/**
 * Runs a job with a database-backed lock: if the same job is already running (and the
 * lock is fresher than 30 minutes) this invocation is skipped. Every run is recorded in
 * `job_runs` with its stats or error.
 */
export async function runJob(job: JobName, fn: (log: typeof logger) => Promise<Record<string, unknown>>): Promise<JobResult> {
  const db = getDb();
  const log = logger.child({ job });

  const [active] = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(and(eq(jobRuns.job, job), eq(jobRuns.status, "running"), gte(jobRuns.startedAt, new Date(Date.now() - STALE_LOCK_MS))))
    .limit(1);
  if (active) {
    log.warn({ activeRunId: active.id }, "job already running — skipping");
    return { status: "skipped", runId: null, stats: { reason: "already running" } };
  }

  const [run] = await db.insert(jobRuns).values({ job, status: "running" }).returning({ id: jobRuns.id });
  const runId = run!.id;
  const started = Date.now();
  log.info({ runId }, "job started");
  try {
    const stats = { ...(await fn(log.child({ runId }))), durationMs: Date.now() - started };
    await db.update(jobRuns).set({ status: "succeeded", finishedAt: new Date(), stats }).where(eq(jobRuns.id, runId));
    log.info({ runId, stats }, "job succeeded");
    return { status: "succeeded", runId, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(jobRuns).set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 2000) }).where(eq(jobRuns.id, runId));
    log.error({ runId, err }, "job failed");
    return { status: "failed", runId, stats: {}, error: message };
  }
}

export async function recentJobRuns(limit = 10) {
  return getDb().select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(limit);
}
