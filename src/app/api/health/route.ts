import { sql } from "drizzle-orm";
import { getDb, getDbHandle } from "@/server/db/client";
import { aiStatus } from "@/services/ai/registry";

export const dynamic = "force-dynamic";

/** Liveness + readiness: verifies the database answers and reports provider mode. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    const ai = aiStatus();
    return Response.json({ status: "ok", db: getDbHandle().driver, ai: { provider: ai.active, mock: ai.isMock } });
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
