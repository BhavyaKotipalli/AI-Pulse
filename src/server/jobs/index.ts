import { env } from "@/lib/env";
import { ingestAll } from "@/server/ingest/pipeline";
import { runDaily } from "./daily";
import { runEnrich } from "./enrich";
import { runInsights } from "./insights";
import { runJob, type JobName, type JobResult } from "./runner";

/**
 * Pipeline order: ingest → enrich (repeat until nothing is pending) → insights → daily.
 * Every job is idempotent and resumable, so schedulers can call them freely.
 */
export const JOBS: Record<JobName, () => Promise<JobResult>> = {
  ingest: () => runJob("ingest", (log) => ingestAll(log, { githubToken: env().GITHUB_TOKEN })),
  enrich: () => runJob("enrich", (log) => runEnrich(log)),
  insights: () => runJob("insights", (log) => runInsights(log)),
  daily: () => runJob("daily", (log) => runDaily(log)),
};

export function isJobName(v: string): v is JobName {
  return v in JOBS;
}
