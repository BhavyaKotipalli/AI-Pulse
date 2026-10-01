import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isJobName, JOBS } from "@/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingestion fetches ~16 sources; allow up to 5 minutes (Vercel Fluid compute).
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false; // fail closed: cron endpoints are disabled until a secret is configured
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const { job } = await ctx.params;
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isJobName(job)) return Response.json({ error: `Unknown job "${job}"` }, { status: 404 });
  try {
    const result = await JOBS[job]();
    return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
  } catch (err) {
    logger.error({ err, job }, "cron invocation failed");
    return Response.json({ error: "Job crashed" }, { status: 500 });
  }
}
