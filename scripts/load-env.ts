import { config } from "dotenv";

/**
 * Environment loading for CLI scripts.
 *
 * Next.js itself loads `.env.local` before `.env`, but plain `dotenv/config`
 * only reads `.env`. Without this, `npm run db:seed` would silently miss the
 * values you put in `.env.local` and write blank settings. Loaded in the same
 * precedence order Next uses: the first file to define a variable wins, and
 * anything already exported in the shell always wins over both.
 */
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
