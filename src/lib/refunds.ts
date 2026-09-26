import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import {
  orders,
  payments,
  refunds,
  type AdminUser,
  type Order,
  type Payment,
  type Refund,
} from "@/db/schema";
import { recordAudit } from "./audit";
import { sendOrderEmail } from "./email/send";
import { releaseInventoryForOrder } from "./inventory";
import { logError, logEvent } from "./logger";
import { addOrderEvent, transitionOrder } from "./orders";
import { createRefund as createProviderRefund, RazorpayError } from "./payments/razorpay";

/**
 * Refunds.
 *
 * Financial truth first: the provider refund is created once, recorded once,
 * and only then do the softer side effects (order status, stock, email) run.
 * A double-clicked refund button is stopped by a unique idempotency key, so
 * the customer can never be refunded twice for the same action.
 */

export type RefundableInfo = {
  payment: Payment | null;
  refundedInPaise: number;
  refundableInPaise: number;
  canRefund: boolean;
  reason?: string;
};

export async function getPrimaryPayment(
  orderId: string,
): Promise<Payment | undefined> {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.captured, true)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return row;
}

export async function refundableInfo(order: Order): Promise<RefundableInfo> {
  if (order.paymentMethod === "cod") {
    return {
      payment: null,
      refundedInPaise: order.refundedInPaise,
      refundableInPaise: 0,
      canRefund: false,
      reason: "Cash on Delivery orders are settled with the courier, not Razorpay.",
    };
  }

  const payment = (await getPrimaryPayment(order.id)) ?? null;
  if (!payment) {
    return {
      payment: null,
      refundedInPaise: order.refundedInPaise,
      refundableInPaise: 0,
      canRefund: false,
      reason: "No captured payment is recorded for this order.",
    };
  }

  const refundable = payment.amountInPaise - payment.amountRefundedInPaise;
  return {
    payment,
    refundedInPaise: payment.amountRefundedInPaise,
    refundableInPaise: Math.max(refundable, 0),
    canRefund: refundable > 0,
    reason: refundable > 0 ? undefined : "This payment is fully refunded.",
  };
}

export async function listRefundsForOrder(orderId: string): Promise<Refund[]> {
  return db
    .select()
    .from(refunds)
    .where(eq(refunds.orderId, orderId))
    .orderBy(desc(refunds.createdAt));
}

export type CreateRefundInput = {
  order: Order;
  amountInPaise: number;
  reason: string;
  admin: Pick<AdminUser, "id" | "email">;
  /** Stable per user action (e.g. the form's submission token). */
  idempotencyKey: string;
  /** Put the units back on the shelf (default: unless already delivered). */
  restock?: boolean;
};

export type CreateRefundResult =
  | { ok: true; refund: Refund; duplicate: boolean }
  | { ok: false; error: string };

export async function createOrderRefund(
  input: CreateRefundInput,
): Promise<CreateRefundResult> {
  const info = await refundableInfo(input.order);
  if (!info.canRefund || !info.payment) {
    return { ok: false, error: info.reason ?? "This order cannot be refunded." };
  }
  if (input.amountInPaise <= 0) {
    return { ok: false, error: "Enter a refund amount greater than zero." };
  }
  if (input.amountInPaise > info.refundableInPaise) {
    return {
      ok: false,
      error: "Refund amount is larger than the refundable balance.",
    };
  }

  // 1. Reserve the action. A duplicate submit lands on the unique index.
  const [reserved] = await db
    .insert(refunds)
    .values({
      orderId: input.order.id,
      paymentId: info.payment.id,
      provider: "razorpay",
      amountInPaise: input.amountInPaise,
      status: "pending",
      reason: input.reason.slice(0, 300),
      requestedByAdminId: input.admin.id,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing({ target: refunds.idempotencyKey })
    .returning();

  if (!reserved) {
    const [existing] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.idempotencyKey, input.idempotencyKey))
      .limit(1);
    return existing
      ? { ok: true, refund: existing, duplicate: true }
      : { ok: false, error: "Could not record the refund. Try again." };
  }

  // 2. Ask Razorpay for the money back.
  let providerRefundId: string | null = null;
  let providerStatus = "pending";
  try {
    const providerRefund = await createProviderRefund({
      paymentId: info.payment.providerPaymentId!,
      amountInPaise: input.amountInPaise,
      receipt: input.order.orderNumber,
      notes: { order: input.order.orderNumber, reason: input.reason.slice(0, 80) },
    });
    providerRefundId = providerRefund.id;
    providerStatus = providerRefund.status;
  } catch (err) {
    const message =
      err instanceof RazorpayError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Refund request failed";
    await db
      .update(refunds)
      .set({ status: "failed", error: message.slice(0, 300), updatedAt: new Date() })
      .where(eq(refunds.id, reserved.id));
    await recordAudit({
      admin: input.admin,
      action: "refund_failed",
      entityType: "refund",
      entityId: reserved.id,
      metadata: {
        orderNumber: input.order.orderNumber,
        amountInPaise: input.amountInPaise,
      },
    });
    logError("refund_failed", err, { orderNumber: input.order.orderNumber });
    return { ok: false, error: message };
  }

  // 3. Persist the financial truth atomically.
  const refund = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(refunds)
      .set({
        providerRefundId,
        status: providerStatus === "processed" ? "processed" : "pending",
        processedAt: providerStatus === "processed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, reserved.id))
      .returning();

    await applyRefundAccounting(tx, {
      order: input.order,
      paymentId: info.payment!.id,
      amountInPaise: input.amountInPaise,
    });

    return updated;
  });

  // 4. Order state, stock and notifications.
  const [freshOrder] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.order.id))
    .limit(1);

  const fullyRefunded =
    freshOrder.refundedInPaise >= freshOrder.totalInPaise;
  const shouldRestock =
    input.restock ?? (freshOrder.status !== "delivered");

  try {
    if (fullyRefunded && freshOrder.status !== "refunded") {
      await transitionOrder({
        orderId: freshOrder.id,
        to: "refunded",
        actor: { type: "admin", admin: input.admin },
        note: `Refund issued: ${input.reason.slice(0, 200)}`,
        dedupeKey: `${freshOrder.id}:refunded:${refund.id}`,
        paymentStatus: "refunded",
      });
    } else {
      await addOrderEvent(db, {
        orderId: freshOrder.id,
        status: freshOrder.status,
        previousStatus: freshOrder.status,
        note: `Partial refund of ₹${(input.amountInPaise / 100).toFixed(2)} issued`,
        actor: { type: "admin", admin: input.admin },
        dedupeKey: `${freshOrder.id}:refund:${refund.id}`,
      });
    }

    if (shouldRestock) {
      await db.transaction((tx) =>
        releaseInventoryForOrder(tx, freshOrder, "refund", input.admin.id),
      );
    }
  } catch (err) {
    logError("internal_error", err, {
      stage: "refund_side_effects",
      orderNumber: freshOrder.orderNumber,
    });
  }

  await recordAudit({
    admin: input.admin,
    action: "refund_created",
    entityType: "refund",
    entityId: refund.id,
    metadata: {
      orderNumber: freshOrder.orderNumber,
      amountInPaise: input.amountInPaise,
      providerRefundId,
      full: fullyRefunded,
    },
  });

  logEvent("refund_created", {
    orderNumber: freshOrder.orderNumber,
    amount: input.amountInPaise,
    full: fullyRefunded,
  });

  const [orderForEmail] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, freshOrder.id))
    .limit(1);
  await sendOrderEmail(orderForEmail, "refunded", {
    idempotencyKey: `${refund.id}:refunded`,
    extra: { refundAmountInPaise: input.amountInPaise },
  });

  return { ok: true, refund, duplicate: false };
}

/** Moves refunded amounts onto the payment and the order. */
export async function applyRefundAccounting(
  client: DbClient,
  input: { order: Order; paymentId: string; amountInPaise: number },
): Promise<void> {
  await client
    .update(payments)
    .set({
      amountRefundedInPaise: sql`${payments.amountRefundedInPaise} + ${input.amountInPaise}`,
      status: sql`case when ${payments.amountRefundedInPaise} + ${input.amountInPaise} >= ${payments.amountInPaise} then 'refunded' else 'partially_refunded' end`,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, input.paymentId));

  await client
    .update(orders)
    .set({
      refundedInPaise: sql`least(${orders.refundedInPaise} + ${input.amountInPaise}, ${orders.totalInPaise})`,
      paymentStatus: sql`case when ${orders.refundedInPaise} + ${input.amountInPaise} >= ${orders.totalInPaise} then 'refunded' else 'partially_refunded' end`,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, input.order.id));
}

/** Webhook-driven status updates for a refund we already know about. */
export async function markRefundStatusFromProvider(input: {
  providerRefundId: string;
  status: "processed" | "failed";
  error?: string | null;
}): Promise<Refund | undefined> {
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.providerRefundId, input.providerRefundId))
    .limit(1);
  if (!refund) return undefined;
  if (refund.status === input.status) return refund;

  const [updated] = await db
    .update(refunds)
    .set({
      status: input.status,
      processedAt: input.status === "processed" ? new Date() : refund.processedAt,
      error: input.error?.slice(0, 300) ?? refund.error,
      updatedAt: new Date(),
    })
    .where(eq(refunds.id, refund.id))
    .returning();
  return updated;
}

export type RefundSearch = {
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function searchRefunds({
  status,
  page = 1,
  pageSize = 25,
}: RefundSearch) {
  const where =
    status && status !== "all"
      ? eq(refunds.status, status as Refund["status"])
      : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        refund: refunds,
        orderNumber: orders.orderNumber,
        orderId: orders.id,
      })
      .from(refunds)
      .innerJoin(orders, eq(refunds.orderId, orders.id))
      .where(where)
      .orderBy(desc(refunds.createdAt))
      .limit(pageSize)
      .offset((Math.max(page, 1) - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(refunds)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return { rows, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
}
