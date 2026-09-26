import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import {
  drizzle as drizzleNode,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "./schema";

/**
 * Environment-adaptive database client.
 *
 * - On Vercel with a Neon / Vercel Postgres endpoint (POSTGRES_URL) we use
 *   Neon's serverless driver (WebSockets), which behaves correctly across
 *   short-lived serverless invocations.
 * - Everywhere else (local dev, classic VPS, Supabase/RDS URLs) we use the
 *   standard node-postgres TCP pool.
 *
 * The client is created lazily behind a Proxy so merely importing this module
 * during a production build never touches the network or requires env vars.
 */

export type Database = NodePgDatabase<typeof schema>;

/**
 * The transactional handle passed to `db.transaction(async (tx) => …)`.
 * Services accept `Database | Transaction` so callers can compose several
 * operations into one atomic unit.
 */
export type Transaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

/** Either the pooled client or an open transaction. */
export type Db = Database | Transaction;

function connectionUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database URL configured. Set POSTGRES_URL (Vercel/Neon) or DATABASE_URL.",
    );
  }
  return url;
}

function isNeonEndpoint(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("neon.tech");
  } catch {
    return false;
  }
}

function shouldUseServerlessDriver(url: string): boolean {
  // Explicit Neon endpoints always get the serverless driver; on Vercel,
  // POSTGRES_URL (the Vercel Postgres / Neon integration) implies it too.
  return (
    isNeonEndpoint(url) ||
    (process.env.VERCEL === "1" && Boolean(process.env.POSTGRES_URL))
  );
}

function createClient(): Database {
  const url = connectionUrl();

  if (shouldUseServerlessDriver(url)) {
    // Node >= 22 ships a global WebSocket; older runtimes need ws.
    if (typeof globalThis.WebSocket === "undefined") {
      neonConfig.webSocketConstructor = ws;
    }
    const pool = new NeonPool({ connectionString: url, max: 4 });
    return drizzleNeon(pool, { schema }) as unknown as Database;
  }

  const pool = new PgPool({ connectionString: url, max: 8 });
  return drizzleNode(pool, { schema });
}

const globalForDb = globalThis as unknown as { __beevoDb?: Database };

function getClient(): Database {
  if (!globalForDb.__beevoDb) {
    globalForDb.__beevoDb = createClient();
  }
  return globalForDb.__beevoDb;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop, _receiver) {
    const client = getClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export { schema };
