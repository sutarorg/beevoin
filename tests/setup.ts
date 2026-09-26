/**
 * Test bootstrap.
 *
 * Database tests need TEST_DATABASE_URL pointing at a throwaway PostgreSQL
 * database (never production). It is copied into DATABASE_URL so the app's
 * own db client connects to it, exactly as it would in production.
 */
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });
config({ path: ".env.local", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}

// Deterministic, side-effect-free defaults for the integrations.
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
delete process.env.RESEND_API_KEY;
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;
