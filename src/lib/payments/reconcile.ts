import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import {
  orders,
  payments,
  products,
  type Order,
  type Payment,
  type PaymentStatus,
} from "@/db/schema";
import { logError, logEvent } from "../logger";
import { transitionOrder } from "../orders";
import {
  sendAdminNewOrderEmail,
  sendLowStockEmail,
  sendOrderEmail,
} from "../email/send";
import {
  capturePayment,
  fetchPayment,
  isRazorpayConfigured,
  type RazorpayPayment,
} from "./razorpay";

/**
 * Canonical Razorpay reconciliation.
 *
 * The browser callback and the webhook are two independent, unordered
 * sources of truth about the same payment. Both funnel through
 * `reconcileRazorpayPayment()`, which:
 *
 *   1. resolves our order from OUR OWN records (never from the browser),
 *   2. re-fetches the payment from Razorpay server-side,
 *   3. checks order linkage, amount, currency and capture state,
 *   4. captures an `authorized` payment when the account isn't auto-capture,
 *   5. writes one canonical payment row and confirms the order exactly once.
 *
 * Every step is idempotent, so duplicate callbacks, webhook retries and
 * simultaneous arrivals converge on the same state.
 */

export type ReconcileSource = "callback" | "webhook" | "admin";

export type ReconcileOutcome =
  | { state: "paid"; order: Order; payment: Payment; firstConfirmation: boolean }
  | { state: "pending"; order: Order; payment: Payment | null; reason: string }
  | { state: "failed"; order: Order; payment: Payment | null; reason: string }
  | { state: "mismatch"; reason: string; order?: Order }
  | { state: "unknown_order"; reason: string };

/** Creates (or reuses) the open payment attempt for a Razorpay order. */
export async function recordPaymentAttempt(input: {
  orderId: string;
  razorpayOrderId: string;
  amountInPaise: number;
}): Promise<Payment> {
  const [existing] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.providerOrderId, input.razorpayOrderId),
        isNull(payments.providerPaymentId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [row] = await db
    .insert(payments)
    .values({
      orderId: input.orderId,
      provider: "razorpay",
      providerOrderId: input.razorpayOrderId,
      amountInPaise: input.amountInPaise,
      currency: "INR",
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();

  if (row) return row;
  const [fallback] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerOrderId, input.razorpayOrderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return fallback;
}

async function findOrderForRazorpayOrder(
  razorpayOrderId: string,
): Promise<Order | undefined> {
  const [byOrder] = await db
    .select()
    .from(orders)
    .where(eq(orders.razorpayOrderId, razorpayOrderId))
    .limit(1);
  if (byOrder) return byOrder;

  const [attempt] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerOrderId, razorpayOrderId))
    .limit(1);
  if (!attempt) return undefined;

  const [byPayment] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, attempt.orderId))
    .limit(1);
  return byPayment;
}

function mapStatus(payment: RazorpayPayment): PaymentStatus {
  switch (payment.status) {
    case "captured":
      return "captured";
    case "authorized":
      return "authorized";
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

/** Upserts the canonical payment row for a provider payment id. */
async function upsertPayment(
  client: DbClient,
  input: {
    orderId: string;
    providerOrderId: string | null;
    payment: RazorpayPayment;
    verified: boolean;
  },
): Promise<Payment> {
  const { payment } = input;
  const status = mapStatus(payment);
  const now = new Date();
  const values = {
    orderId: input.orderId,
    provider: "razorpay",
    providerOrderId: input.providerOrderId ?? payment.order_id ?? null,
    providerPaymentId: payment.id,
    amountInPaise: payment.amount,
    currency: payment.currency,
    method: payment.method ?? null,
    status,
    captured: status === "captured" || payment.captured === true,
    verified: input.verified,
    amountRefundedInPaise: payment.amount_refunded ?? 0,
    errorCode: payment.error_code ?? null,
    errorDescription: payment.error_description?.slice(0, 300) ?? null,
    authorizedAt: status === "authorized" || status === "captured" ? now : null,
    capturedAt: status === "captured" ? now : null,
    failedAt: status === "failed" ? now : null,
    verifiedAt: input.verified ? now : null,
    updatedAt: now,
  };

  const [row] = await client
    .insert(payments)
    .values(values)
    .onConflictDoUpdate({
      target: [payments.provider, payments.providerPaymentId],
      set: {
        status: values.status,
        method: values.method,
        captured: values.captured,
        verified: values.verified,
        amountRefundedInPaise: values.amountRefundedInPaise,
        errorCode: values.errorCode,
        errorDescription: values.errorDescription,
        capturedAt: values.capturedAt,
        verifiedAt: values.verifiedAt,
        updatedAt: now,
      },
    })
    .returning();

  // Close the open (payment-id-less) attempt for this Razorpay order.
  if (values.providerOrderId) {
    await client
      .delete(payments)
      .where(
        and(
          eq(payments.providerOrderId, values.providerOrderId),
          isNull(payments.providerPaymentId),
        ),
      );
  }

  return row;
}

export type ReconcileInput = {
  source: ReconcileSource;
  razorpayPaymentId: string;
  razorpayOrderId?: string | null;
  /** Only used as a cross-check; the trusted link is our stored order id. */
  expectedOrderNumber?: string | null;
};

export async function reconcileRazorpayPayment(
  input: ReconcileInput,
): Promise<ReconcileOutcome> {
  if (!isRazorpayConfigured()) {
    return { state: "mismatch", reason: "Razorpay is not configured." };
  }

  // 1. Always re-fetch the payment from Razorpay: never trust client input.
  let payment: RazorpayPayment;
  try {
    payment = await fetchPayment(input.razorpayPaymentId);
  } catch (err) {
    logError("payment_failed", err, { source: input.source });
    return { state: "mismatch", reason: "Could not fetch the payment from Razorpay." };
  }

  const razorpayOrderId = payment.order_id ?? input.razorpayOrderId ?? null;
  if (!razorpayOrderId) {
    return { state: "mismatch", reason: "Payment is not linked to a Razorpay order." };
  }
  if (input.razorpayOrderId && input.razorpayOrderId !== razorpayOrderId) {
    return {
      state: "mismatch",
      reason: "Payment does not belong to the supplied Razorpay order.",
    };
  }

  // 2. Resolve our order from our own records.
  const order = await findOrderForRazorpayOrder(razorpayOrderId);
  if (!order) {
    return {
      state: "unknown_order",
      reason: "No Beevo order matches this Razorpay order.",
    };
  }
  if (
    input.expectedOrderNumber &&
    input.expectedOrderNumber.toUpperCase() !== order.orderNumber
  ) {
    return {
      state: "mismatch",
      reason: "Payment does not match this order.",
      order,
    };
  }

  // 3. The payment may not already belong to a different order.
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, payment.id))
    .limit(1);
  if (existingPayment && existingPayment.orderId !== order.id) {
    logEvent("payment_failed", {
      reason: "payment_already_consumed",
      orderNumber: order.orderNumber,
    });
    return {
      state: "mismatch",
      reason: "This payment is already applied to another order.",
      order,
    };
  }

  // 4. Amount and currency must match exactly.
  if (payment.currency !== "INR" || payment.amount !== order.totalInPaise) {
    const stored = await db.transaction((tx) =>
      upsertPayment(tx, {
        orderId: order.id,
        providerOrderId: razorpayOrderId,
        payment,
        verified: false,
      }),
    );
    logEvent("payment_failed", {
      reason: "amount_or_currency_mismatch",
      orderNumber: order.orderNumber,
    });
    return {
      state: "mismatch",
      reason: "Payment amount or currency does not match the order.",
      order,
    };
  }
  void existingPayment;

  // 5. Failed payments: record and let the customer retry the same order.
  if (payment.status === "failed") {
    const stored = await db.transaction(async (tx) => {
      const row = await upsertPayment(tx, {
        orderId: order.id,
        providerOrderId: razorpayOrderId,
        payment,
        verified: true,
      });
      if (order.paymentStatus === "pending") {
        await tx
          .update(orders)
          .set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "pending")));
      }
      return row;
    });
    logEvent("payment_failed", {
      orderNumber: order.orderNumber,
      source: input.source,
    });
    return {
      state: "failed",
      order,
      payment: stored,
      reason: payment.error_description ?? "The payment failed at Razorpay.",
    };
  }

  // 6. Authorized but not captured: capture it before treating it as money.
  let effective = payment;
  if (payment.status === "authorized") {
    try {
      effective = await capturePayment({
        paymentId: payment.id,
        amountInPaise: order.totalInPaise,
        currency: "INR",
      });
      logEvent("payment_captured", { orderNumber: order.orderNumber });
    } catch (err) {
      // Another worker may have captured it a moment ago — re-read the truth.
      try {
        effective = await fetchPayment(payment.id);
      } catch {
        effective = payment;
      }
      if (effective.status !== "captured") {
        const stored = await db.transaction((tx) =>
          upsertPayment(tx, {
            orderId: order.id,
            providerOrderId: razorpayOrderId,
            payment: effective,
            verified: true,
          }),
        );
        logError("payment_failed", err, {
          orderNumber: order.orderNumber,
          stage: "capture",
        });
        return {
          state: "pending",
          order,
          payment: stored,
          reason: "Payment is authorized but not captured yet.",
        };
      }
    }
  }

  if (effective.status !== "captured") {
    const stored = await db.transaction((tx) =>
      upsertPayment(tx, {
        orderId: order.id,
        providerOrderId: razorpayOrderId,
        payment: effective,
        verified: true,
      }),
    );
    return {
      state: "pending",
      order,
      payment: stored,
      reason: `Payment is ${effective.status}.`,
    };
  }

  // 7. Captured: write money state and confirm the order exactly once.
  let firstConfirmation = false;
  let confirmedOrder = order;
  let storedPayment: Payment;

  try {
    const result = await db.transaction(async (tx) => {
      const row = await upsertPayment(tx, {
        orderId: order.id,
        providerOrderId: razorpayOrderId,
        payment: effective,
        verified: true,
      });

      await tx
        .update(orders)
        .set({
          paymentStatus: "paid",
          razorpayPaymentId: effective.id,
          razorpayOrderId,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      const transition = await transitionOrder(
        {
          orderId: order.id,
          to: "confirmed",
          actor:
            input.source === "webhook"
              ? { type: "webhook", label: "razorpay" }
              : { type: "system", label: input.source },
          note: "Online payment received and verified",
          dedupeKey: `${order.id}:payment_confirmed`,
          paymentStatus: "paid",
        },
        tx,
      );

      return { row, transition };
    });

    storedPayment = result.row;
    confirmedOrder = result.transition.order;
    firstConfirmation = result.transition.changed;
  } catch (err) {
    logError("payment_failed", err, {
      orderNumber: order.orderNumber,
      stage: "confirm",
    });
    return {
      state: "mismatch",
      reason: "Could not apply the payment to this order.",
      order,
    };
  }

  logEvent("payment_reconciled", {
    orderNumber: confirmedOrder.orderNumber,
    source: input.source,
    firstConfirmation,
  });

  // 8. Side effects after the transaction commits. Failures here never undo
  //    the payment — they are logged and retryable from the admin.
  if (firstConfirmation) {
    await sendOrderEmail(confirmedOrder, "payment_received");
    await sendAdminNewOrderEmail(confirmedOrder);
    await notifyLowStock(confirmedOrder.productId);
  }

  return {
    state: "paid",
    order: confirmedOrder,
    payment: storedPayment,
    firstConfirmation,
  };
}

/** Low-stock alert, de-duplicated per remaining-quantity value. */
export async function notifyLowStock(productId: string | null): Promise<void> {
  if (!productId) return;
  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product) return;
    if (product.inventoryQuantity > product.lowStockThreshold) return;
    await sendLowStockEmail({
      productId: product.id,
      productName: product.name,
      quantity: product.inventoryQuantity,
      threshold: product.lowStockThreshold,
      stateKey: String(product.inventoryQuantity),
    });
  } catch (err) {
    logError("email_failed", err, { template: "admin_low_stock" });
  }
}
