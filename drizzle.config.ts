import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle schema-management config.
 *
 * Migrations are the production path (`npm run db:migrate`). `drizzle-kit
 * generate` writes new SQL files into ./drizzle; never use `push` against a
 * production database.
 *
 * Connection resolution matches src/db/index.ts: POSTGRES_URL (the Vercel /
 * Neon integration) wins, then DATABASE_URL.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
