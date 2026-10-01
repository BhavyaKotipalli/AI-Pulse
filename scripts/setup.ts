/**
 * Migrates the database and loads the demo dataset.
 *   npm run setup            → migrate; seed only if empty
 *   npm run db:seed          → migrate; wipe content tables and reseed
 *   SEED_MODE=reference      → production: curated reference data only (no simulated news)
 */
import "./load-env";
import { closeDb, getDbHandle } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { clearContent, isSeeded, reduceToReference, seedDemo } from "@/server/db/seed";

async function main() {
  // Neon (and the Vercel–Neon integration) expose a direct, non-pooled URL; prefer it for migrations.
  if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
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
  // SEED_MODE=reference (production): keep curated reference data only, never simulated news.
  const mode = process.argv.includes("--reference") || process.env.SEED_MODE === "reference" ? "reference" : "demo";
  if (mode === "reference") await reduceToReference(db);
  console.log(`[setup] ${mode} dataset loaded`, counts);
}

main()
  .catch((err) => {
    console.error("[setup] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
