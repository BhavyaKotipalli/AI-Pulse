import "./load-env";
import { desc, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/client";
import { items, storyClusters } from "@/server/db/schema";
async function main() {
  const rows = await getDb().select({ s: items.score, k: items.kind, t: items.title, sc: storyClusters.sourceCount, m: items.metrics }).from(items).leftJoin(storyClusters, eq(items.clusterId, storyClusters.id)).where(eq(items.isDemo, false)).orderBy(desc(items.score)).limit(20);
  for (const r of rows) console.log(r.s, r.k.padEnd(7), String(r.sc).padEnd(2), (r.m.hnPoints ? `hn${r.m.hnPoints}` : "").padEnd(7), r.t.slice(0, 75));
  await closeDb();
}
void main();
