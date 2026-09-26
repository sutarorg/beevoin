import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe.
 *
 * Checks only what the app itself controls: the process is alive and the
 * database answers. External providers (Razorpay, Resend, Supabase) are NOT
 * called — a health check must not spend money, burn quota or fail because a
 * third party is slow. Configuration presence is reported as booleans only;
 * no secret, URL or key value is ever returned.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "unreachable" = "unreachable";

  try {
    await db.execute(sql`select 1`);
    database = "ok";
  } catch {
    database = "unreachable";
  }

  const body = {
    ok: database === "ok",
    service: "beevo",
    database,
    latencyMs: Date.now() - startedAt,
    configured: {
      supabaseAuth: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
      razorpay: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      ),
      razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      resend: Boolean(process.env.RESEND_API_KEY),
    },
    at: new Date().toISOString(),
  };

  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
