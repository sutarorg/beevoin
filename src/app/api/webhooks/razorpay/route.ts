import { handleRazorpayWebhook } from "@/lib/payments/webhook";
import { isWebhookConfigured } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook receiver.
 *
 * Deliberately NOT protected by the same-origin/CSRF logic used for browser
 * endpoints — Razorpay is a server, not a browser. Authenticity comes from
 * the HMAC signature over the raw body, and replay safety comes from the
 * `webhook_events` idempotency table.
 */
export async function POST(request: Request) {
  if (!isWebhookConfigured()) {
    return Response.json(
      { ok: false, error: "Webhooks are not configured" },
      { status: 503 },
    );
  }

  // Raw body first: the signature is computed over these exact bytes.
  const rawBody = await request.text();

  const result = await handleRazorpayWebhook({
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    eventIdHeader: request.headers.get("x-razorpay-event-id"),
  });

  return Response.json(result.body, { status: result.status });
}
