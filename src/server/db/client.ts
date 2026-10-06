import path from "node:path";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Database client.
 * - `DATABASE_URL` set → node-postgres pool (Neon, Supabase, Docker Postgres).
 * - otherwise → embedded PGlite with pgvector at `PGLITE_DIR` (default `.data/pglite`).
 * Both expose the same Drizzle API; the PGlite instance is typed as the pg variant.
 */
export type Database = NodePgDatabase<typeof schema>;

interface DbHandle {
  db: Database;
  driver: "pg" | "pglite";
  close: () => Promise<void>;
}

const globalForDb = globalThis as unknown as { __aiPulseDb?: DbHandle };

/**
 * TLS policy for hosted Postgres. Local databases use no TLS. Remote ones are always
 * encrypted; certificate verification is on only when DATABASE_SSL=strict, because
 * managed poolers (Supabase, some Neon endpoints) present chains that are not in
 * Node's default trust store. An explicit sslmode in the URL is left to the driver.
 */
function sslFor(url: string): false | { rejectUnauthorized: boolean } | undefined {
  const mode = process.env.DATABASE_SSL;
  if (mode === "off") return false;
  try {
    const u = new URL(url);
    if (["localhost", "127.0.0.1", "::1"].includes(u.hostname)) return mode === "strict" ? { rejectUnauthorized: true } : false;
    if (u.searchParams.has("sslmode")) return undefined;
  } catch {
    return undefined;
  }
  return { rejectUnauthorized: mode === "strict" };
}

function create(): DbHandle {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10), ssl: sslFor(url) });
    return { db: drizzlePg(pool, { schema }), driver: "pg", close: () => pool.end() };
  }
  const configured = process.env.PGLITE_DIR ?? ".data/pglite";
  // "memory://" gives an ephemeral database (used by integration tests).
  const dir = configured.startsWith("memory://") ? configured : path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  if (!dir.startsWith("memory://")) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir, { extensions: { vector } });
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  return { db, driver: "pglite", close: () => client.close() };
}

export function getDbHandle(): DbHandle {
  if (!globalForDb.__aiPulseDb) globalForDb.__aiPulseDb = create();
  return globalForDb.__aiPulseDb;
}

export function getDb(): Database {
  return getDbHandle().db;
}

export async function closeDb(): Promise<void> {
  const handle = globalForDb.__aiPulseDb;
  if (!handle) return;
  globalForDb.__aiPulseDb = undefined;
  await handle.close();
}

export { schema };
