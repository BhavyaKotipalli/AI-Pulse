/**
 * Run a background job locally:  npm run job ingest | daily | purge-demo
 * (Stop `npm run dev` first when using the embedded PGlite database.)
 */
import "./load-env";
import { closeDb } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { purgeDemo } from "@/server/jobs/daily";
import { isJobName, JOBS } from "@/server/jobs";

async function main() {
  const name = process.argv[2] ?? "";
  await runMigrations();
  if (name === "purge-demo") {
    console.log(await purgeDemo());
    return;
  }
  if (!isJobName(name)) {
    console.error(`Usage: npm run job <${Object.keys(JOBS).join(" | ")} | purge-demo>`);
    process.exitCode = 1;
    return;
  }
  const result = await JOBS[name]();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
