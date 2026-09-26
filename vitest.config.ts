import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests run in plain Node against a REAL PostgreSQL database
 * (TEST_DATABASE_URL) — the concurrency, idempotency and money rules this
 * project cares about cannot be proven against a mocked database.
 *
 * Unit-only tests (status machine, permissions) run without a database.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a build-time guard for Next; it has no meaning here.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      "next/cache": fileURLToPath(new URL("./tests/stubs/next-cache.ts", import.meta.url)),
    },
  },
});
