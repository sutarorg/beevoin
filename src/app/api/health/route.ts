import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe: is the app running and can it reach the
 * database? Deliberately does NOT call Razorpay, Resend or Supabase — health
 * checks shouldn't spend third-party quota — and never reveals configuration
 * values, only whether the required ones are present.
 */
export async function GET() {
  const checks = {
    app: true,
    database: false,
    razorpay: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    ),
    razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    supabaseAuth: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };

  try {
    await db.execute(sql`select 1`);
    checks.database = true;
  } catch {
    return Response.json({ ok: false, checks }, { status: 503 });
  }

  return Response.json({ ok: true, checks });
}
