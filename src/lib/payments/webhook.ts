import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, refunds, webhookEvents } from "@/db/schema";
import { logError, logEvent } from "../logger";
import {
  applyRefundAccounting,
  markRefundStatusFromProvider,
} from "../refunds";
import { orders } from "@/db/schema";
import { reconcileRazorpayPayment } from "./reconcile";
import { verifyWebhookSignature } from "./razorpay";

/**
 * Razorpay webhook processing.
 *
 * Contract:
 *  - the raw body is verified against RAZORPAY_WEBHOOK_SECRET *before* it is
 *    parsed (no JSON parsing of unverified input),
 *  - every event is claimed in `webhook_events` (unique on provider+event id)
 *    so retries and duplicates are no-ops,
 *  - each event type is mapped deliberately; unknown types are recorded and
 *    ignored rather than mutating an order.
 */

export const HANDLED_EVENTS = [
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.created",
  "refund.processed",
  "refund.failed",
] as const;

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    refund?: { entity?: Record<string, unknown> };
    order?: { entity?: Record<string, unknown> };
  };
};

export type WebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

function entityString(
  entity: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = entity?.[key];
  return typeof value === "string" ? value : null;
}

function entityNumber(
  entity: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = entity?.[key];
  return typeof value === "number" ? value : null;
}

export async function handleRazorpayWebhook(input: {
  rawBody: string;
  signature: string | null;
  eventIdHeader: string | null;
}): Promise<WebhookResult> {
  // 1. Signature first — on the raw, unparsed body.
  if (!verifyWebhookSignature(input.rawBody, input.signature)) {
    logEvent("webhook_invalid_signature", {
      hasSignature: Boolean(input.signature),
    });
    return { status: 400, body: { ok: false, error: "Invalid signature" } };
  }

  // 2. Now it is safe to parse.
  let parsed: RazorpayWebhookPayload;
  try {
    parsed = JSON.parse(input.rawBody) as RazorpayWebhookPayload;
  } catch {
    return { status: 400, body: { ok: false, error: "Malformed payload" } };
  }

  const eventType = parsed.event ?? "unknown";
  const eventId =
    input.eventIdHeader ??
    `sha256:${createHash("sha256").update(input.rawBody).digest("hex").slice(0, 40)}`;

  const paymentEntity = parsed.payload?.payment?.entity;
  const refundEntity = parsed.payload?.refund?.entity;

  const summary: Record<string, unknown> = {
    paymentId: entityString(paymentEntity, "id"),
    razorpayOrderId:
      entityString(paymentEntity, "order_id") ??
      entityString(parsed.payload?.order?.entity, "id"),
    refundId: entityString(refundEntity, "id"),
    amount:
      entityNumber(paymentEntity, "amount") ?? entityNumber(refundEntity, "amount"),
  };

  // 3. Claim the event. A duplicate delivery stops right here.
  const [claimed] = await db
    .insert(webhookEvents)
    .values({
      provider: "razorpay",
      eventId,
      eventType,
      signatureVerified: true,
      processed: false,
      summary,
    })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning();

  if (!claimed) {
    logEvent("webhook_duplicate", { eventType });
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  logEvent("webhook_received", { eventType });

  // 4. Dispatch.
  try {
    let note = "ignored";

    switch (eventType) {
      case "payment.authorized":
      case "payment.captured":
      case "payment.failed":
      case "order.paid": {
        const paymentId = entityString(paymentEntity, "id");
        if (!paymentId) {
          note = "no payment id in payload";
          break;
        }
        const outcome = await reconcileRazorpayPayment({
          source: "webhook",
          razorpayPaymentId: paymentId,
          razorpayOrderId: entityString(paymentEntity, "order_id"),
        });
        note = outcome.state;
        break;
      }

      case "refund.created":
      case "refund.processed":
      case "refund.failed": {
        const refundId = entityString(refundEntity, "id");
        if (!refundId) {
          note = "no refund id in payload";
          break;
        }
        const status =
          eventType === "refund.failed"
            ? "failed"
            : eventType === "refund.processed"
              ? "processed"
              : "pending";

        const known = await markRefundStatusFromProvider({
          providerRefundId: refundId,
          status: status === "pending" ? "processed" : status,
        });

        if (!known) {
          await ingestExternalRefund({
            providerRefundId: refundId,
            providerPaymentId: entityString(refundEntity, "payment_id"),
            amountInPaise: entityNumber(refundEntity, "amount"),
            status: eventType === "refund.failed" ? "failed" : "processed",
          });
          note = "external refund recorded";
        } else {
          note = `refund ${status}`;
        }
        break;
      }

      default:
        note = `unhandled event: ${eventType}`;
        break;
    }

    await db
      .update(webhookEvents)
      .set({ processed: true, processedAt: new Date(), error: null, summary: { ...summary, note } })
      .where(eq(webhookEvents.id, claimed.id));

    return { status: 200, body: { ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(webhookEvents)
      .set({
        processed: false,
        processedAt: new Date(),
        error: message.slice(0, 500),
      })
      .where(eq(webhookEvents.id, claimed.id));
    logError("webhook_error", err, { eventType });
    // 500 asks Razorpay to retry; our idempotency makes that safe.
    return { status: 500, body: { ok: false, error: "Processing failed" } };
  }
}

/**
 * A refund created outside Beevo (e.g. from the Razorpay dashboard) still has
 * to be reflected in our books.
 */
async function ingestExternalRefund(input: {
  providerRefundId: string;
  providerPaymentId: string | null;
  amountInPaise: number | null;
  status: "processed" | "failed";
}): Promise<void> {
  if (!input.providerPaymentId || !input.amountInPaise) return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, input.providerPaymentId))
    .limit(1);
  if (!payment) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);
  if (!order) return;

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(refunds)
      .values({
        orderId: order.id,
        paymentId: payment.id,
        provider: "razorpay",
        providerRefundId: input.providerRefundId,
        amountInPaise: input.amountInPaise!,
        status: input.status,
        reason: "Refund created in the Razorpay dashboard",
        idempotencyKey: `provider:${input.providerRefundId}`,
        processedAt: input.status === "processed" ? new Date() : null,
      })
      .onConflictDoNothing({ target: refunds.idempotencyKey })
      .returning();

    if (inserted && input.status === "processed") {
      await applyRefundAccounting(tx, {
        order,
        paymentId: payment.id,
        amountInPaise: input.amountInPaise!,
      });
    }
  });
}
