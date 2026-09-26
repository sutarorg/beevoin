import { logEvent } from "@/lib/http";
import {
  isWebhookConfigured,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  handleRazorpayEvent,
} from "@/lib/services/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook endpoint.
 *
 * Deliberately NOT subject to the browser same-origin/CSRF guard used by the
 * store's own endpoints — Razorpay is a server, not a browser. It is
 * authenticated by HMAC signature and made safe by event-id idempotency.
 *
 * The RAW body is read first and verified before anything parses it: a
 * re-serialised JSON body produces a different digest and would always fail.
 */
export async function POST(request: Request) {
  if (!isWebhookConfigured()) {
    // 503 makes Razorpay retry once the secret is configured.
    logEvent("webhook_unconfigured", { provider: "razorpay" });
    return Response.json(
      { ok: false, error: "Webhook secret not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    logEvent("webhook_signature_invalid", { provider: "razorpay" });
    return Response.json(
      { ok: false, error: "Invalid signature." },
      { status: 400 },
    );
  }

  // Only now is it safe to parse.
  let payload: { event?: string } & Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as { event?: string };
  } catch {
    return Response.json(
      { ok: false, error: "Malformed payload." },
      { status: 400 },
    );
  }

  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  // Razorpay sends a unique delivery id per event; fall back to a stable
  // digest of the body so idempotency still holds if the header is absent.
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    (await digest(rawBody));

  const claim = await claimWebhookEvent({
    provider: "razorpay",
    eventId,
    eventType,
    signatureVerified: true,
  });

  if (!claim.claimed) {
    logEvent("webhook_duplicate", { eventType });
    return Response.json({ ok: true, duplicate: true });
  }

  logEvent("webhook_received", { eventType });

  try {
    const result = await handleRazorpayEvent(payload);
    await completeWebhookEvent(claim.row.id, { orderId: result.orderId });
    return Response.json({ ok: true, handled: result.handled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing error";
    await completeWebhookEvent(claim.row.id, { error: message.slice(0, 500) });
    logEvent("webhook_processing_failed", { eventType, error: message });
    // 500 asks Razorpay to retry; the event row is marked unprocessed so the
    // retry re-runs the handler instead of being treated as a duplicate.
    return Response.json(
      { ok: false, error: "Processing failed." },
      { status: 500 },
    );
  }
}

async function digest(body: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return `sha256:${createHash("sha256").update(body).digest("hex").slice(0, 64)}`;
}
