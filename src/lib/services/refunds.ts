import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderEvents,
  orders,
  payments,
  refunds,
  type Order,
  type Payment,
  type Refund,
} from "@/db/schema";
import { logEvent } from "@/lib/http";
import { emailEventKey, sendOrderEmail } from "@/lib/email/send";
import type { AdminActor } from "@/lib/auth/admin";
import { recordAudit } from "./audit";
import { applyRefundToCustomer } from "./customers";
import { releaseInventoryForOrder } from "./inventory";
import { invalidateProductCache } from "./products";
import {
  createRefund as createProviderRefund,
  isRazorpayConfigured,
  RazorpayError,
} from "@/lib/payments/razorpay";

/**
 * Refunds.
 *
 * Financial truth first: the refundable balance is reserved atomically BEFORE
 * Razorpay is called, so a double-clicked button cannot issue two refunds.
 * If the provider call fails the reservation is rolled back. If a later,
 * non-critical step fails (email, restock) the money movement is still
 * recorded correctly and the operator can reconcile from /admin/refunds.
 *
 * All Razorpay calls happen server-side. The browser never sees a key.
 */

export class RefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundError";
  }
}

export type RefundableInfo = {
  eligible: boolean;
  reason?: string;
  payment?: Payment;
  refundableInPaise: number;
  alreadyRefundedInPaise: number;
};

export async function getRefundable(order: Order): Promise<RefundableInfo> {
  if (order.paymentMethod !== "online") {
    return {
      eligible: false,
      reason: "Cash-on-delivery orders are not refunded through Razorpay.",
      refundableInPaise: 0,
      alreadyRefundedInPaise: order.refundedInPaise,
    };
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.orderId, order.id), eq(payments.captured, true)),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!payment) {
    return {
      eligible: false,
      reason: "No captured payment exists for this order.",
      refundableInPaise: 0,
      alreadyRefundedInPaise: order.refundedInPaise,
    };
  }

  const refundable = Math.max(
    0,
    payment.amountInPaise - payment.amountRefundedInPaise,
  );

  return {
    eligible: refundable > 0,
    reason: refundable > 0 ? undefined : "This payment is fully refunded.",
    payment,
    refundableInPaise: refundable,
    alreadyRefundedInPaise: payment.amountRefundedInPaise,
  };
}

/**
 * Issue a full or partial refund.
 *
 * Order of operations (§76): authorize → validate order → validate amount →
 * reserve balance → provider refund → store refund → update payment → update
 * order → restore inventory → order event → audit → email.
 */
export async function issueRefund(input: {
  orderId: string;
  amountInPaise: number;
  reason: string;
  restock: boolean;
  actor: AdminActor;
}): Promise<Refund> {
  if (!isRazorpayConfigured()) {
    throw new RefundError("Razorpay is not configured on this deployment.");
  }
  if (!Number.isInteger(input.amountInPaise) || input.amountInPaise <= 0) {
    throw new RefundError("Refund amount must be a positive whole number of paise.");
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  if (!order) throw new RefundError("Order not found.");

  const info = await getRefundable(order);
  if (!info.eligible || !info.payment) {
    throw new RefundError(info.reason ?? "This order cannot be refunded.");
  }
  if (input.amountInPaise > info.refundableInPaise) {
    throw new RefundError(
      "Refund amount is larger than the refundable balance.",
    );
  }

  const payment = info.payment;

  // Duplicate-click guard: an identical refund raised seconds ago is a
  // double submit, not a second business decision.
  const [recent] = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(
      and(
        eq(refunds.orderId, order.id),
        eq(refunds.amountInPaise, input.amountInPaise),
        gte(refunds.createdAt, new Date(Date.now() - 60_000)),
        sql`${refunds.status} in ('pending','processed')`,
      ),
    )
    .limit(1);
  if (recent) {
    throw new RefundError(
      "An identical refund was just created. Check /admin/refunds before retrying.",
    );
  }

  // Reserve the balance atomically. If another request got there first the
  // conditional UPDATE matches zero rows and we stop before spending money.
  const reserved = await db
    .update(payments)
    .set({
      amountRefundedInPaise: sql`${payments.amountRefundedInPaise} + ${input.amountInPaise}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(payments.id, payment.id),
        sql`${payments.amountRefundedInPaise} + ${input.amountInPaise} <= ${payments.amountInPaise}`,
      ),
    )
    .returning({ id: payments.id });

  if (reserved.length === 0) {
    throw new RefundError(
      "The refundable balance changed. Reload the order and try again.",
    );
  }

  const [refundRow] = await db
    .insert(refunds)
    .values({
      orderId: order.id,
      paymentId: payment.id,
      provider: "razorpay",
      amountInPaise: input.amountInPaise,
      status: "pending",
      reason: input.reason.slice(0, 300),
      requestedByAdminId: input.actor.id,
      restockRequested: input.restock,
    })
    .returning();

  try {
    const providerRefund = await createProviderRefund({
      paymentId: payment.providerPaymentId!,
      amountInPaise: input.amountInPaise,
      idempotencyKey: refundRow.id,
      notes: { beevo_order: order.orderNumber, beevo_refund: refundRow.id },
    });

    const finalStatus = providerRefund.status === "failed" ? "failed" : (providerRefund.status === "processed" ? "processed" : "pending");

    const updatedRefund = await finaliseRefund({
      refundId: refundRow.id,
      providerRefundId: providerRefund.id,
      status: finalStatus,
      order,
      payment,
      amountInPaise: input.amountInPaise,
      restock: input.restock,
      actor: input.actor,
    });

    logEvent("refund_created", {
      orderNumber: order.orderNumber,
      amount: input.amountInPaise,
      status: finalStatus,
    });
    return updatedRefund;
  } catch (err) {
    // Provider rejected the refund — release the reserved balance so the
    // operator can retry, and keep the failed attempt for the audit trail.
    await db
      .update(payments)
      .set({
        amountRefundedInPaise: sql`greatest(0, ${payments.amountRefundedInPaise} - ${input.amountInPaise})`,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    const message =
      err instanceof RazorpayError || err instanceof Error
        ? err.message
        : "Refund failed at the provider.";

    await db
      .update(refunds)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(refunds.id, refundRow.id));

    logEvent("refund_failed", {
      orderNumber: order.orderNumber,
      error: message,
    });
    throw new RefundError(message);
  }
}

/**
 * Apply a successful (or pending) provider refund to Beevo state. Runs in one
 * transaction so payment status, order status, inventory and the order event
 * all move together.
 */
async function finaliseRefund(input: {
  refundId: string;
  providerRefundId: string;
  status: "pending" | "processed" | "failed";
  order: Order;
  payment: Payment;
  amountInPaise: number;
  restock: boolean;
  actor: AdminActor;
}): Promise<Refund> {
  const result = await db.transaction(async (tx) => {
    const [refundRow] = await tx
      .update(refunds)
      .set({
        providerRefundId: input.providerRefundId,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, input.refundId))
      .returning();

    const [currentOrder] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.order.id))
      .limit(1);

    const totalRefunded = currentOrder.refundedInPaise + input.amountInPaise;
    const fullyRefunded = totalRefunded >= currentOrder.totalInPaise;

    await tx
      .update(payments)
      .set({
        status: fullyRefunded ? "refunded" : "partially_refunded",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, input.payment.id));

    const [updatedOrder] = await tx
      .update(orders)
      .set({
        refundedInPaise: totalRefunded,
        paymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
        // `refunded` is only ever set by this workflow — the manual status
        // machine explicitly refuses it.
        status: fullyRefunded ? "refunded" : currentOrder.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, currentOrder.id))
      .returning();

    if (input.restock) {
      await releaseInventoryForOrder(
        tx,
        {
          id: currentOrder.id,
          productId: currentOrder.productId,
          quantity: currentOrder.quantity,
          inventoryReservedAt: currentOrder.inventoryReservedAt,
          inventoryReleasedAt: currentOrder.inventoryReleasedAt,
        },
        "refund",
        input.actor.id,
      );
      await tx
        .update(refunds)
        .set({ restockedAt: new Date() })
        .where(eq(refunds.id, input.refundId));
    }

    await applyRefundToCustomer(
      tx,
      currentOrder.customerId,
      input.amountInPaise,
    );

    await tx.insert(orderEvents).values({
      orderId: currentOrder.id,
      previousStatus: currentOrder.status,
      status: updatedOrder.status,
      actor: "admin",
      actorAdminId: input.actor.id,
      note: `Refund of ${(input.amountInPaise / 100).toFixed(2)} INR ${input.status}`,
    });

    return { refundRow, updatedOrder };
  });

  if (input.restock) invalidateProductCache();

  await recordAudit(input.actor, {
    action: "refund_created",
    entityType: "order",
    entityId: input.order.id,
    metadata: {
      orderNumber: input.order.orderNumber,
      amountInPaise: input.amountInPaise,
      refundId: input.refundId,
      providerRefundId: input.providerRefundId,
      status: input.status,
      restock: input.restock,
    },
  });

  // Email last, and never fatal.
  await sendOrderEmail(result.updatedOrder, "refunded", {
    eventKey: emailEventKey(input.order.id, "refunded", input.refundId),
    context: { refundAmountInPaise: input.amountInPaise },
  });

  return result.refundRow;
}

/** Applied by the refund.processed / refund.failed webhooks. */
export async function markRefundStatusFromWebhook(input: {
  providerRefundId: string;
  status: "processed" | "failed";
}): Promise<void> {
  const [refundRow] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.providerRefundId, input.providerRefundId))
    .limit(1);
  if (!refundRow || refundRow.status === input.status) return;

  await db.transaction(async (tx) => {
    await tx
      .update(refunds)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(refunds.id, refundRow.id));

    if (input.status === "failed") {
      // Money did not move — give the balance back.
      if (refundRow.paymentId) {
        await tx
          .update(payments)
          .set({
            amountRefundedInPaise: sql`greatest(0, ${payments.amountRefundedInPaise} - ${refundRow.amountInPaise})`,
            status: "captured",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, refundRow.paymentId));
      }
      await tx
        .update(orders)
        .set({
          refundedInPaise: sql`greatest(0, ${orders.refundedInPaise} - ${refundRow.amountInPaise})`,
          paymentStatus: "paid",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, refundRow.orderId));
    }

    const [latest] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, refundRow.orderId))
      .limit(1);

    await tx.insert(orderEvents).values({
      orderId: refundRow.orderId,
      status: latest?.status ?? "refunded",
      actor: "webhook",
      note: `Razorpay refund ${input.providerRefundId} ${input.status}`,
    });
  });

  logEvent("refund_webhook_applied", { status: input.status });
}

export async function listRefundsForOrder(orderId: string): Promise<Refund[]> {
  return db
    .select()
    .from(refunds)
    .where(eq(refunds.orderId, orderId))
    .orderBy(desc(refunds.createdAt));
}
