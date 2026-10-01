/**
 * Migrates the database and loads the demo dataset.
 *   npm run setup            → migrate; seed only if empty
 *   npm run db:seed          → migrate; wipe content tables and reseed
 */
import "./load-env";
import { closeDb, getDbHandle } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { clearContent, isSeeded, seedDemo } from "@/server/db/seed";

async function main() {
  const reseed = process.argv.includes("--reseed");
  const { db, driver } = getDbHandle();
  console.log(`[setup] driver=${driver}`);

  await runMigrations();
  console.log("[setup] migrations applied");

  if (process.argv.includes("--migrate-only")) return;

  if (!reseed && (await isSeeded(db))) {
    console.log("[setup] database already contains data — skipping seed (use npm run db:seed to reseed)");
    return;
  }
  if (reseed) await clearContent(db);
  const counts = await seedDemo(db);
  console.log("[setup] demo dataset loaded", counts);
}

main()
  .catch((err) => {
    console.error("[setup] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
