import { env } from "@/lib/env";
import { ingestAll } from "@/server/ingest/pipeline";
import { runDaily } from "./daily";
import { runJob, type JobName, type JobResult } from "./runner";

export const JOBS: Record<JobName, () => Promise<JobResult>> = {
  ingest: () => runJob("ingest", (log) => ingestAll(log, { githubToken: env().GITHUB_TOKEN })),
  daily: () => runJob("daily", (log) => runDaily(log)),
};

export function isJobName(v: string): v is JobName {
  return v in JOBS;
}
