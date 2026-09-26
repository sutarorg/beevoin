import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents, type WebhookEvent } from "@/db/schema";
import { logEvent } from "@/lib/http";
import { reconcileRazorpayPayment, getOrderByRazorpayOrderId } from "./payments";
import { markRefundStatusFromWebhook } from "./refunds";

/**
 * Provider webhook intake with database-enforced idempotency.
 *
 * `webhook_events (provider, event_id)` is UNIQUE. A replayed delivery hits
 * that constraint and is recognised as a duplicate before any business logic
 * runs, so a repeated event can never create a second payment, a second order
 * event, a second email, a second inventory decrement or a second refund.
 */

export type ClaimResult =
  | { claimed: true; row: WebhookEvent }
  | { claimed: false; row: WebhookEvent; alreadyProcessed: boolean };

/**
 * Claims an event for processing. Returns `claimed: false` when this exact
 * event id has been seen before.
 */
export async function claimWebhookEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  signatureVerified: boolean;
}): Promise<ClaimResult> {
  try {
    const [row] = await db
      .insert(webhookEvents)
      .values({
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        signatureVerified: input.signatureVerified,
        attempts: 1,
      })
      .returning();
    return { claimed: true, row };
  } catch {
    const [existing] = await db
      .select()
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, input.provider),
          eq(webhookEvents.eventId, input.eventId),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Could not record webhook event.");

    const [bumped] = await db
      .update(webhookEvents)
      .set({ attempts: sql`${webhookEvents.attempts} + 1` })
      .where(eq(webhookEvents.id, existing.id))
      .returning();

    // A previous delivery that FAILED must be retryable: only a delivery we
    // actually finished processing counts as a duplicate.
    if (!existing.processed) return { claimed: true, row: bumped ?? existing };

    return {
      claimed: false,
      row: bumped ?? existing,
      alreadyProcessed: true,
    };
  }
}

export async function completeWebhookEvent(
  id: string,
  input: { orderId?: string | null; error?: string | null } = {},
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      processed: !input.error,
      processedAt: new Date(),
      orderId: input.orderId ?? null,
      error: input.error ?? null,
    })
    .where(eq(webhookEvents.id, id));
}

/* ---------------------------------------------------------------- */

type RazorpayEntity = Record<string, unknown>;

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    refund?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
};

function str(entity: RazorpayEntity | undefined, key: string): string | null {
  const value = entity?.[key];
  return typeof value === "string" ? value : null;
}

/**
 * Explicit event map. Nothing is mutated for an event we did not plan for —
 * an unknown event is acknowledged (so Razorpay stops retrying) and recorded,
 * but never allowed to touch an order.
 */
export const HANDLED_RAZORPAY_EVENTS = [
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.created",
  "refund.processed",
  "refund.failed",
] as const;

export type RazorpayHandleResult = {
  handled: boolean;
  orderId: string | null;
  detail: string;
};

export async function handleRazorpayEvent(
  payload: RazorpayWebhookPayload,
): Promise<RazorpayHandleResult> {
  const event = payload.event ?? "";
  const paymentEntity = payload.payload?.payment?.entity;
  const refundEntity = payload.payload?.refund?.entity;
  const orderEntity = payload.payload?.order?.entity;

  switch (event) {
    case "payment.authorized":
    case "payment.captured":
    case "payment.failed":
    case "order.paid": {
      const paymentId = str(paymentEntity, "id");
      if (!paymentId) {
        return { handled: false, orderId: null, detail: "No payment entity." };
      }
      // Never trust the payload amounts: reconciliation re-reads the payment
      // from Razorpay and re-checks amount, currency and order linkage.
      const outcome = await reconcileRazorpayPayment({
        source: "webhook",
        razorpayPaymentId: paymentId,
        razorpayOrderId:
          str(paymentEntity, "order_id") ?? str(orderEntity, "id"),
      });

      switch (outcome.status) {
        case "confirmed":
          return {
            handled: true,
            orderId: outcome.order.id,
            detail: outcome.alreadyDone
              ? "Already reconciled."
              : "Order confirmed.",
          };
        case "pending_capture":
          return {
            handled: true,
            orderId: outcome.order.id,
            detail: "Payment awaiting capture.",
          };
        case "failed":
          return {
            handled: true,
            orderId: outcome.order.id,
            detail: `Payment failed: ${outcome.reason}`,
          };
        default:
          return { handled: false, orderId: null, detail: outcome.reason };
      }
    }

    case "refund.created":
      return {
        handled: true,
        orderId: null,
        detail: "Refund creation acknowledged; awaiting processed/failed.",
      };

    case "refund.processed":
    case "refund.failed": {
      const refundId = str(refundEntity, "id");
      if (!refundId) {
        return { handled: false, orderId: null, detail: "No refund entity." };
      }
      await markRefundStatusFromWebhook({
        providerRefundId: refundId,
        status: event === "refund.processed" ? "processed" : "failed",
      });
      return { handled: true, orderId: null, detail: `Refund ${event}.` };
    }

    default: {
      // Acknowledged, recorded, and deliberately ignored.
      const rzpOrderId = str(orderEntity, "id");
      const order = rzpOrderId
        ? await getOrderByRazorpayOrderId(rzpOrderId)
        : undefined;
      logEvent("webhook_ignored", { event });
      return {
        handled: false,
        orderId: order?.id ?? null,
        detail: `Unmapped event "${event}" ignored.`,
      };
    }
  }
}
