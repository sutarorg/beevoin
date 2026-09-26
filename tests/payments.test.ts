import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, products, webhookEvents } from "@/db/schema";
import {
  createTestProduct,
  hasDatabase,
  resetDatabase,
  uniqueCustomer,
} from "./helpers";

/**
 * Razorpay is mocked at the HTTP-client boundary: everything below it — the
 * reconciliation rules, the database writes, the idempotency guarantees — is
 * the real code running against a real database.
 */
const razorpayState = {
  payments: new Map<string, Record<string, unknown>>(),
  captures: [] as string[],
};

vi.mock("@/lib/payments/razorpay", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/razorpay")>(
    "@/lib/payments/razorpay",
  );
  return {
    ...actual,
    isRazorpayConfigured: () => true,
    isWebhookConfigured: () => true,
    verifyWebhookSignature: () => true,
    verifyPaymentSignature: () => true,
    fetchPayment: async (id: string) => {
      const payment = razorpayState.payments.get(id);
      if (!payment) throw new Error(`unknown payment ${id}`);
      return payment;
    },
    capturePayment: async (input: { paymentId: string }) => {
      const id = input.paymentId;
      razorpayState.captures.push(id);
      const payment = razorpayState.payments.get(id)!;
      const captured = { ...payment, status: "captured", captured: true };
      razorpayState.payments.set(id, captured);
      return captured;
    },
  };
});

const { reconcileRazorpayPayment, recordPaymentAttempt } = await import(
  "@/lib/payments/reconcile"
);
const { handleRazorpayWebhook } = await import("@/lib/payments/webhook");
const { createOrder, transitionOrder } = await import("@/lib/orders");

const suite = hasDatabase ? describe : describe.skip;

function razorpayPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay_test_1",
    order_id: "order_test_1",
    amount: 149900,
    currency: "INR",
    status: "captured",
    captured: true,
    method: "upi",
    ...overrides,
  };
}

async function seedOnlineOrder(seed: number, razorpayOrderId: string) {
  const product = await createTestProduct({ inventoryQuantity: 10 });
  const { order } = await createOrder({
    customer: uniqueCustomer(seed),
    quantity: 1,
    paymentMethod: "online",
    product,
  });
  await db
    .update(orders)
    .set({ razorpayOrderId })
    .where(eq(orders.id, order.id));
  await recordPaymentAttempt({
    orderId: order.id,
    razorpayOrderId,
    amountInPaise: order.totalInPaise,
  });
  await transitionOrder({
    orderId: order.id,
    to: "payment_pending",
    actor: { type: "customer" },
  });
  return { order, product };
}

suite("payment reconciliation", () => {
  beforeEach(async () => {
    await resetDatabase();
    razorpayState.payments.clear();
    razorpayState.captures = [];
  });

  it("confirms the order once and only once for a captured payment", async () => {
    const { order, product } = await seedOnlineOrder(11, "order_test_1");
    razorpayState.payments.set("pay_test_1", razorpayPayment());

    const first = await reconcileRazorpayPayment({
      source: "callback",
      razorpayPaymentId: "pay_test_1",
      razorpayOrderId: "order_test_1",
      expectedOrderNumber: order.orderNumber,
    });
    const second = await reconcileRazorpayPayment({
      source: "webhook",
      razorpayPaymentId: "pay_test_1",
      razorpayOrderId: "order_test_1",
    });

    expect(first.state).toBe("paid");
    expect(second.state).toBe("paid");
    if (first.state === "paid") expect(first.firstConfirmation).toBe(true);
    if (second.state === "paid") expect(second.firstConfirmation).toBe(false);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.status).toBe("confirmed");
    expect(row.paymentStatus).toBe("paid");
    expect(row.razorpayPaymentId).toBe("pay_test_1");

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id));
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0].verified).toBe(true);
    expect(paymentRows[0].captured).toBe(true);

    // Stock moved exactly once despite two reconciliations.
    expect(row.inventoryCommittedAt).not.toBeNull();
    const [stock] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(stock.inventoryQuantity).toBe(9);
  });

  it("captures an authorised payment instead of leaving money hanging", async () => {
    const { order } = await seedOnlineOrder(12, "order_test_2");
    razorpayState.payments.set(
      "pay_test_2",
      razorpayPayment({
        id: "pay_test_2",
        order_id: "order_test_2",
        status: "authorized",
        captured: false,
      }),
    );

    const result = await reconcileRazorpayPayment({
      source: "callback",
      razorpayPaymentId: "pay_test_2",
      razorpayOrderId: "order_test_2",
      expectedOrderNumber: order.orderNumber,
    });

    expect(razorpayState.captures).toEqual(["pay_test_2"]);
    expect(result.state).toBe("paid");
  });

  it("refuses a payment whose amount does not match the order", async () => {
    const { order } = await seedOnlineOrder(13, "order_test_3");
    razorpayState.payments.set(
      "pay_test_3",
      razorpayPayment({ id: "pay_test_3", order_id: "order_test_3", amount: 100 }),
    );

    const result = await reconcileRazorpayPayment({
      source: "callback",
      razorpayPaymentId: "pay_test_3",
      razorpayOrderId: "order_test_3",
      expectedOrderNumber: order.orderNumber,
    });

    expect(result.state).toBe("mismatch");
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.status).not.toBe("confirmed");
    expect(row.paymentStatus).not.toBe("paid");
  });

  it("refuses a payment in a foreign currency", async () => {
    const { order } = await seedOnlineOrder(14, "order_test_4");
    razorpayState.payments.set(
      "pay_test_4",
      razorpayPayment({
        id: "pay_test_4",
        order_id: "order_test_4",
        currency: "USD",
      }),
    );

    const result = await reconcileRazorpayPayment({
      source: "callback",
      razorpayPaymentId: "pay_test_4",
      razorpayOrderId: "order_test_4",
      expectedOrderNumber: order.orderNumber,
    });
    expect(result.state).toBe("mismatch");
  });

  it("records a failed payment without confirming the order", async () => {
    const { order } = await seedOnlineOrder(15, "order_test_5");
    razorpayState.payments.set(
      "pay_test_5",
      razorpayPayment({
        id: "pay_test_5",
        order_id: "order_test_5",
        status: "failed",
        captured: false,
        error_description: "Payment declined by bank",
      }),
    );

    const result = await reconcileRazorpayPayment({
      source: "callback",
      razorpayPaymentId: "pay_test_5",
      razorpayOrderId: "order_test_5",
      expectedOrderNumber: order.orderNumber,
    });

    expect(result.state).toBe("failed");
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.paymentStatus).toBe("failed");
    expect(row.status).toBe("payment_pending");
  });

  it("ignores a payment that belongs to no known order", async () => {
    razorpayState.payments.set(
      "pay_orphan",
      razorpayPayment({ id: "pay_orphan", order_id: "order_unknown" }),
    );

    const result = await reconcileRazorpayPayment({
      source: "webhook",
      razorpayPaymentId: "pay_orphan",
      razorpayOrderId: "order_unknown",
    });
    expect(result.state).toBe("unknown_order");
  });
});

suite("razorpay webhooks", () => {
  beforeEach(async () => {
    await resetDatabase();
    razorpayState.payments.clear();
    razorpayState.captures = [];
  });

  it("processes an event once and ignores the retry", async () => {
    const { order } = await seedOnlineOrder(21, "order_hook_1");
    razorpayState.payments.set(
      "pay_hook_1",
      razorpayPayment({ id: "pay_hook_1", order_id: "order_hook_1" }),
    );

    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_hook_1", order_id: "order_hook_1", amount: 149900 },
        },
      },
    });

    const first = await handleRazorpayWebhook({
      rawBody: body,
      signature: "signature",
      eventIdHeader: "evt_1",
    });
    const retry = await handleRazorpayWebhook({
      rawBody: body,
      signature: "signature",
      eventIdHeader: "evt_1",
    });

    expect(first.status).toBe(200);
    expect(retry.body.duplicate).toBe(true);

    const events = await db.select().from(webhookEvents);
    expect(events).toHaveLength(1);
    expect(events[0].processed).toBe(true);
    expect(events[0].signatureVerified).toBe(true);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.status).toBe("confirmed");
  });

  it("records unhandled event types without touching orders", async () => {
    const body = JSON.stringify({ event: "payment.dispute.created", payload: {} });
    const result = await handleRazorpayWebhook({
      rawBody: body,
      signature: "signature",
      eventIdHeader: "evt_2",
    });

    expect(result.status).toBe(200);
    const [event] = await db.select().from(webhookEvents);
    expect(event.processed).toBe(true);
    expect(String(event.summary.note)).toContain("unhandled");
  });

  it("rejects a malformed body after signature verification", async () => {
    const result = await handleRazorpayWebhook({
      rawBody: "not json",
      signature: "signature",
      eventIdHeader: "evt_3",
    });
    expect(result.status).toBe(400);
    expect(await db.select().from(webhookEvents)).toHaveLength(0);
  });
});
