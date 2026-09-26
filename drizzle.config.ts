import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Schema-management config. Uses POSTGRES_URL (Vercel/Neon) or DATABASE_URL,
 * falling back to the local sandbox database.
 *
 * Push schema to a remote database without touching .env:
 *   POSTGRES_URL="postgres://...neon.tech/..." npx drizzle-kit push
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
