/**
 * Applies every pending SQL migration in ./drizzle to DATABASE_URL.
 *
 * Safe to run repeatedly and safe to run against a database that already
 * holds live v1 data: the baseline migration only creates what is missing and
 * upgrades existing tables in place. Nothing is ever dropped.
 *
 *   npm run db:migrate
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : connectionString.includes("localhost") ||
          connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });

  const db = drizzle(pool);

  console.log("Applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");

  await pool.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
