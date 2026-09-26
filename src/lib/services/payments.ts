import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderEvents,
  orders,
  payments,
  type Order,
  type Payment,
} from "@/db/schema";
import { logEvent } from "@/lib/http";
import { emailEventKey, sendAdminNotification, sendOrderEmail } from "@/lib/email/send";
import { formatINR } from "@/lib/format";
import { maybeAlertLowStock, reserveInventoryForOrder } from "./inventory";
import { invalidateProductCache } from "./products";
import { notificationEmail } from "./settings";
import {
  capturePayment,
  fetchPayment,
  isRazorpayConfigured,
  type RazorpayPayment,
} from "@/lib/payments/razorpay";

/**
 * Razorpay payment reconciliation — ONE canonical path.
 *
 * The browser callback and the webhook are two independent, unordered reports
 * about the same payment. Neither is trusted: this service always re-reads the
 * payment from Razorpay's API and then applies a single idempotent state
 * transition. Whichever report arrives first does the work; every later report
 * (including retries and simultaneous arrivals) is a verified no-op.
 *
 * Invariants enforced here:
 *   1. the Razorpay order id must be the one Beevo stored for this order;
 *   2. the payment must belong to that Razorpay order;
 *   3. the amount must equal the Beevo order total, to the paisa;
 *   4. the currency must be INR;
 *   5. the payment must be CAPTURED before the order is treated as paid
 *      (an `authorized` payment is captured first when the account uses
 *      manual capture);
 *   6. a payment id can only ever be consumed by one Beevo order.
 */

export type ReconcileSource = "callback" | "webhook" | "admin";

export type ReconcileOutcome =
  | { status: "confirmed"; order: Order; payment: Payment; alreadyDone: boolean }
  | { status: "pending_capture"; order: Order; payment: Payment }
  | { status: "failed"; order: Order; reason: string }
  | { status: "mismatch"; reason: string }
  | { status: "unknown_order"; reason: string };

export async function getOrderByRazorpayOrderId(
  razorpayOrderId: string,
): Promise<Order | undefined> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.razorpayOrderId, razorpayOrderId))
    .limit(1);
  return order;
}

export async function getPaymentsForOrder(
  orderId: string,
): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt));
}

/** Records a payment attempt at checkout time, before the customer pays. */
export async function recordPaymentAttempt(input: {
  orderId: string;
  providerOrderId: string;
  amountInPaise: number;
}): Promise<void> {
  const existing = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, input.orderId),
        eq(payments.providerOrderId, input.providerOrderId),
        sql`${payments.providerPaymentId} is null`,
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(payments).values({
    orderId: input.orderId,
    provider: "razorpay",
    providerOrderId: input.providerOrderId,
    providerPaymentId: null,
    amountInPaise: input.amountInPaise,
    currency: "INR",
    status: "pending",
  });
  logEvent("payment_order_created", { amount: input.amountInPaise });
}

async function upsertPaymentRecord(input: {
  orderId: string;
  rzp: RazorpayPayment;
  verified: boolean;
  status: Payment["status"];
}): Promise<Payment> {
  const now = new Date();
  const values = {
    orderId: input.orderId,
    provider: "razorpay" as const,
    providerOrderId: input.rzp.order_id,
    providerPaymentId: input.rzp.id,
    amountInPaise: input.rzp.amount,
    currency: input.rzp.currency,
    method: input.rzp.method,
    status: input.status,
    captured: Boolean(input.rzp.captured),
    verified: input.verified,
    amountRefundedInPaise: input.rzp.amount_refunded ?? 0,
    failureReason: input.rzp.error_description?.slice(0, 200) ?? null,
    verifiedAt: input.verified ? now : null,
    capturedAt: input.rzp.captured ? now : null,
    updatedAt: now,
  };

  // Attach the pending attempt row for this Razorpay order if one exists, so
  // the attempt history stays a single row rather than two.
  const [attempt] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, input.orderId),
        sql`${payments.providerPaymentId} is null`,
        input.rzp.order_id
          ? eq(payments.providerOrderId, input.rzp.order_id)
          : sql`true`,
      ),
    )
    .limit(1);

  if (attempt) {
    const [row] = await db
      .update(payments)
      .set(values)
      .where(eq(payments.id, attempt.id))
      .returning();
    if (row) return row;
  }

  const [row] = await db
    .insert(payments)
    .values(values)
    .onConflictDoUpdate({
      target: payments.providerPaymentId,
      set: {
        status: values.status,
        captured: values.captured,
        verified: sql`${payments.verified} or ${values.verified}`,
        method: values.method,
        amountRefundedInPaise: values.amountRefundedInPaise,
        failureReason: values.failureReason,
        capturedAt: sql`coalesce(${payments.capturedAt}, ${values.capturedAt ? values.capturedAt.toISOString() : null}::timestamptz)`,
        verifiedAt: sql`coalesce(${payments.verifiedAt}, ${values.verifiedAt ? values.verifiedAt.toISOString() : null}::timestamptz)`,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

/**
 * Confirm the order for a captured payment. Runs in one transaction:
 * payment status, order status, inventory reservation and the order event all
 * commit together or not at all.
 */
async function confirmPaidOrder(
  orderId: string,
  paymentId: string,
  source: ReconcileSource,
): Promise<{ order: Order; alreadyDone: boolean; reserved?: boolean }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!current) throw new Error("Order vanished during reconciliation.");

    if (current.paymentStatus === "paid" && current.razorpayPaymentId === paymentId) {
      return { order: current, alreadyDone: true };
    }

    const now = new Date();
    const nextStatus =
      current.status === "pending" || current.status === "payment_pending"
        ? "confirmed"
        : current.status;

    const [updated] = await tx
      .update(orders)
      .set({
        paymentStatus: "paid",
        razorpayPaymentId: paymentId,
        status: nextStatus,
        confirmedAt: current.confirmedAt ?? now,
        updatedAt: now,
      })
      .where(eq(orders.id, current.id))
      .returning();

    if (nextStatus === "confirmed" && current.status !== "confirmed") {
      await reserveInventoryForOrder(tx, {
        id: updated.id,
        productId: updated.productId,
        quantity: updated.quantity,
        inventoryReservedAt: current.inventoryReservedAt,
      });
      await tx.insert(orderEvents).values({
        orderId: updated.id,
        previousStatus: current.status,
        status: "confirmed",
        actor: source === "webhook" ? "webhook" : "system",
        note: `Online payment captured and verified (${source})`,
      });
    }

    return { order: updated, alreadyDone: false, reserved: nextStatus === "confirmed" && current.status !== "confirmed" };
  });
}

async function markPaymentFailed(
  order: Order,
  reason: string,
): Promise<void> {
  if (order.paymentStatus === "paid") return;
  await db
    .update(orders)
    .set({ paymentStatus: "failed", updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), sql`${orders.paymentStatus} <> 'paid'`));
  logEvent("payment_failed", { orderNumber: order.orderNumber, reason });
}

/**
 * The single reconciliation entry point used by BOTH the browser callback and
 * the Razorpay webhook.
 */
export async function reconcileRazorpayPayment(input: {
  source: ReconcileSource;
  razorpayPaymentId: string;
  /** Optional hint; the stored value on the order is what is trusted. */
  razorpayOrderId?: string | null;
  order?: Order;
}): Promise<ReconcileOutcome> {
  if (!isRazorpayConfigured()) {
    return { status: "mismatch", reason: "Razorpay is not configured." };
  }

  // 1. Authoritative payment state, straight from Razorpay.
  let rzp: RazorpayPayment;
  try {
    rzp = await fetchPayment(input.razorpayPaymentId);
  } catch (err) {
    return {
      status: "mismatch",
      reason: err instanceof Error ? err.message : "Could not load payment.",
    };
  }

  // 2. Resolve the Beevo order from OUR data, not from the caller.
  let order = input.order;
  if (!order && rzp.order_id) {
    order = await getOrderByRazorpayOrderId(rzp.order_id);
  }
  if (!order) {
    return {
      status: "unknown_order",
      reason: "No Beevo order is linked to this Razorpay payment.",
    };
  }

  // 3. Order linkage.
  if (!order.razorpayOrderId || order.razorpayOrderId !== rzp.order_id) {
    logEvent("payment_order_mismatch", { orderNumber: order.orderNumber });
    return {
      status: "mismatch",
      reason: "This payment belongs to a different Razorpay order.",
    };
  }
  if (input.razorpayOrderId && input.razorpayOrderId !== order.razorpayOrderId) {
    return {
      status: "mismatch",
      reason: "Payment does not match this order.",
    };
  }

  // 4. Payment may not be reused across Beevo orders.
  const [claimed] = await db
    .select({ orderId: payments.orderId })
    .from(payments)
    .where(eq(payments.providerPaymentId, rzp.id))
    .limit(1);
  if (claimed && claimed.orderId !== order.id) {
    logEvent("payment_already_consumed", { orderNumber: order.orderNumber });
    return {
      status: "mismatch",
      reason: "This payment has already been applied to another order.",
    };
  }

  // 5. Amount + currency, to the paisa.
  if (rzp.amount !== order.totalInPaise || rzp.currency !== "INR") {
    logEvent("payment_amount_mismatch", {
      orderNumber: order.orderNumber,
      expected: order.totalInPaise,
      got: rzp.amount,
      currency: rzp.currency,
    });
    await upsertPaymentRecord({
      orderId: order.id,
      rzp,
      verified: false,
      status: "failed",
    });
    await markPaymentFailed(order, "amount_or_currency_mismatch");
    return {
      status: "mismatch",
      reason: "Payment amount or currency does not match this order.",
    };
  }

  // 6. Terminal failure.
  if (rzp.status === "failed") {
    await upsertPaymentRecord({
      orderId: order.id,
      rzp,
      verified: true,
      status: "failed",
    });
    await markPaymentFailed(
      order,
      rzp.error_description ?? "Payment failed at Razorpay",
    );
    await notifyPaymentFailure(order, rzp);
    return {
      status: "failed",
      order,
      reason: rzp.error_description ?? "The payment failed.",
    };
  }

  // 7. Authorised-but-not-captured: capture it (manual-capture accounts).
  //    An authorised payment is NOT money in hand and must never be treated
  //    as paid on its own.
  if (rzp.status === "authorized" && !rzp.captured) {
    try {
      rzp = await capturePayment(rzp.id, order.totalInPaise, "INR");
      logEvent("payment_captured", { orderNumber: order.orderNumber });
    } catch (err) {
      const payment = await upsertPaymentRecord({
        orderId: order.id,
        rzp,
        verified: true,
        status: "authorized",
      });
      logEvent("payment_capture_deferred", {
        orderNumber: order.orderNumber,
        error: err instanceof Error ? err.message : "unknown",
      });
      await db
        .update(orders)
        .set({ paymentStatus: "authorized", updatedAt: new Date() })
        .where(
          and(eq(orders.id, order.id), sql`${orders.paymentStatus} = 'pending'`),
        );
      return { status: "pending_capture", order, payment };
    }
  }

  if (rzp.status !== "captured") {
    const payment = await upsertPaymentRecord({
      orderId: order.id,
      rzp,
      verified: true,
      status: rzp.status === "authorized" ? "authorized" : "pending",
    });
    return { status: "pending_capture", order, payment };
  }

  // 8. Captured — money is in hand. Record, confirm, reserve stock, email.
  const payment = await upsertPaymentRecord({
    orderId: order.id,
    rzp,
    verified: true,
    status: "captured",
  });

  const { order: confirmed, alreadyDone, reserved } = await confirmPaidOrder(
    order.id,
    rzp.id,
    input.source,
  );

  if (!alreadyDone) {
    invalidateProductCache();
    // Post-commit and best-effort: a mail failure must never undo a paid order.
    if (reserved && confirmed.productId) {
      void maybeAlertLowStock(confirmed.productId);
    }
    logEvent("payment_verified", {
      orderNumber: confirmed.orderNumber,
      source: input.source,
    });
  }

  // Idempotent on (order, template, payment id): callback + webhook + retries
  // can all reach this line, and exactly one email goes out.
  await sendOrderEmail(confirmed, "payment_received", {
    eventKey: emailEventKey(confirmed.id, "payment_received", rzp.id),
  });

  return { status: "confirmed", order: confirmed, payment, alreadyDone };
}

async function notifyPaymentFailure(
  order: Order,
  rzp: RazorpayPayment,
): Promise<void> {
  await sendOrderEmail(order, "payment_failed", {
    eventKey: emailEventKey(order.id, "payment_failed", rzp.id),
  });
  const to = await notificationEmail();
  await sendAdminNotification({
    template: "payment_failure_alert",
    to,
    eventKey: `${order.id}:payment_failure_alert:${rzp.id}`,
    orderId: order.id,
    data: {
      orderNumber: order.orderNumber,
      amount: formatINR(order.totalInPaise),
      reason: rzp.error_description ?? rzp.error_code ?? "unknown",
    },
  });
}
