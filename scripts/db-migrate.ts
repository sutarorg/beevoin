import "./load-env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Applies every pending migration in ./drizzle.
 *
 * Safe to run repeatedly and safe against the existing production database:
 * migration 0000 re-creates the four original tables with IF NOT EXISTS, and
 * 0001 only adds tables/columns.
 */
async function main() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database URL configured. Set DATABASE_URL (or POSTGRES_URL) before running migrations.",
    );
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  process.stdout.write("Applying Beevo migrations…\n");
  await migrate(db, { migrationsFolder: "./drizzle" });
  process.stdout.write("Migrations applied.\n");

  await pool.end();
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Migration failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
