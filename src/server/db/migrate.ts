import path from "node:path";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDbHandle } from "./client";

export async function runMigrations(): Promise<void> {
  const { db, driver } = getDbHandle();
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (driver === "pg") {
    await migratePg(db, { migrationsFolder });
  } else {
    // The PGlite handle is typed as the pg variant in client.ts; at runtime it is a PgliteDatabase.
    await migratePglite(db as unknown as PgliteDatabase, { migrationsFolder });
  }
}
