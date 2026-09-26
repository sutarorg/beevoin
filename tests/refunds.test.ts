import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adminUsers,
  orders,
  payments,
  products,
  refunds,
  type AdminUser,
} from "@/db/schema";
import {
  createTestProduct,
  hasDatabase,
  resetDatabase,
  uniqueCustomer,
} from "./helpers";

/** Count every call so a double submit cannot quietly refund twice. */
const providerRefundCalls: Array<{ paymentId: string; amountInPaise: number }> = [];
let providerShouldFail = false;

vi.mock("@/lib/payments/razorpay", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/razorpay")>(
    "@/lib/payments/razorpay",
  );
  return {
    ...actual,
    isRazorpayConfigured: () => true,
    createRefund: async (input: { paymentId: string; amountInPaise: number }) => {
      providerRefundCalls.push(input);
      if (providerShouldFail) {
        throw new actual.RazorpayError("The payment has already been refunded.", 400);
      }
      return {
        id: `rfnd_${providerRefundCalls.length}`,
        payment_id: input.paymentId,
        amount: input.amountInPaise,
        currency: "INR",
        status: "processed",
      };
    },
  };
});

const { createOrderRefund, refundableInfo } = await import("@/lib/refunds");
const { createOrder, transitionOrder } = await import("@/lib/orders");

const suite = hasDatabase ? describe : describe.skip;

async function seedAdmin(): Promise<AdminUser> {
  const [admin] = await db
    .insert(adminUsers)
    .values({
      supabaseUserId: crypto.randomUUID(),
      email: "owner@beevo.in",
      name: "Owner",
      role: "owner",
    })
    .returning();
  return admin;
}

async function seedPaidOrder(seed: number, quantity = 1) {
  const product = await createTestProduct({ inventoryQuantity: 10 });
  const { order } = await createOrder({
    customer: uniqueCustomer(seed),
    quantity,
    paymentMethod: "online",
    product,
  });
  await transitionOrder({
    orderId: order.id,
    to: "confirmed",
    actor: { type: "system", label: "test" },
    paymentStatus: "paid",
  });
  const [payment] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      provider: "razorpay",
      providerOrderId: `order_rf_${seed}`,
      providerPaymentId: `pay_rf_${seed}`,
      amountInPaise: order.totalInPaise,
      currency: "INR",
      status: "captured",
      captured: true,
      verified: true,
    })
    .returning();
  const [fresh] = await db.select().from(orders).where(eq(orders.id, order.id));
  return { order: fresh, payment, product };
}

suite("refunds", () => {
  beforeEach(async () => {
    await resetDatabase();
    providerRefundCalls.length = 0;
    providerShouldFail = false;
  });

  it("refunds in full, marks the order refunded and restocks", async () => {
    const admin = await seedAdmin();
    const { order, product } = await seedPaidOrder(31, 2);

    const result = await createOrderRefund({
      order,
      amountInPaise: order.totalInPaise,
      reason: "Customer returned the printer",
      admin,
      idempotencyKey: "action-1",
    });

    expect(result.ok).toBe(true);
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.status).toBe("refunded");
    expect(row.paymentStatus).toBe("refunded");
    expect(row.refundedInPaise).toBe(order.totalInPaise);

    const [stock] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(stock.inventoryQuantity).toBe(10); // 10 − 2 committed + 2 restocked
  });

  it("charges the provider once when the button is double-clicked", async () => {
    const admin = await seedAdmin();
    const { order } = await seedPaidOrder(32);

    const key = "same-click";
    const results = await Promise.all([
      createOrderRefund({
        order,
        amountInPaise: order.totalInPaise,
        reason: "Duplicate click",
        admin,
        idempotencyKey: key,
      }),
      createOrderRefund({
        order,
        amountInPaise: order.totalInPaise,
        reason: "Duplicate click",
        admin,
        idempotencyKey: key,
      }),
    ]);

    // Whichever way the race resolves — the duplicate is caught by the
    // idempotency key or by the refundable-balance check — the customer is
    // refunded exactly once.
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(providerRefundCalls).toHaveLength(1);

    const rows = await db.select().from(refunds).where(eq(refunds.orderId, order.id));
    expect(rows).toHaveLength(1);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.refundedInPaise).toBe(order.totalInPaise);
  });

  it("replays a repeated idempotency key as a duplicate, not a second refund", async () => {
    const admin = await seedAdmin();
    const { order } = await seedPaidOrder(37, 2);

    // Partial, so the refundable balance check cannot be what stops the
    // second call — only the idempotency key can.
    const first = await createOrderRefund({
      order,
      amountInPaise: 50000,
      reason: "Retry of the same submission",
      admin,
      idempotencyKey: "submission-token",
    });
    const replay = await createOrderRefund({
      order,
      amountInPaise: 50000,
      reason: "Retry of the same submission",
      admin,
      idempotencyKey: "submission-token",
    });

    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(replay).toMatchObject({ ok: true, duplicate: true });
    if (first.ok && replay.ok) expect(replay.refund.id).toBe(first.refund.id);
    expect(providerRefundCalls).toHaveLength(1);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.refundedInPaise).toBe(50000);
  });

  it("supports partial refunds and keeps the balance correct", async () => {
    const admin = await seedAdmin();
    const { order, payment } = await seedPaidOrder(33, 2); // ₹2,998

    const first = await createOrderRefund({
      order,
      amountInPaise: 100000,
      reason: "Goodwill",
      admin,
      idempotencyKey: "partial-1",
    });
    expect(first.ok).toBe(true);

    const [afterFirst] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order.id));
    expect(afterFirst.refundedInPaise).toBe(100000);
    expect(afterFirst.paymentStatus).toBe("partially_refunded");
    expect(afterFirst.status).not.toBe("refunded");

    const info = await refundableInfo(afterFirst);
    expect(info.refundableInPaise).toBe(order.totalInPaise - 100000);

    const second = await createOrderRefund({
      order: afterFirst,
      amountInPaise: info.refundableInPaise,
      reason: "Rest of the order",
      admin,
      idempotencyKey: "partial-2",
    });
    expect(second.ok).toBe(true);

    const [afterSecond] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order.id));
    expect(afterSecond.refundedInPaise).toBe(order.totalInPaise);
    expect(afterSecond.status).toBe("refunded");

    const [paymentRow] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(paymentRow.amountRefundedInPaise).toBe(order.totalInPaise);
    expect(paymentRow.status).toBe("refunded");
  });

  it("refuses to refund more than the payment", async () => {
    const admin = await seedAdmin();
    const { order } = await seedPaidOrder(34);

    const result = await createOrderRefund({
      order,
      amountInPaise: order.totalInPaise + 1,
      reason: "Too much",
      admin,
      idempotencyKey: "too-much",
    });

    expect(result).toEqual({
      ok: false,
      error: "Refund amount is larger than the refundable balance.",
    });
    expect(providerRefundCalls).toHaveLength(0);
  });

  it("refuses to refund a Cash on Delivery order through Razorpay", async () => {
    const admin = await seedAdmin();
    const product = await createTestProduct();
    const { order } = await createOrder({
      customer: uniqueCustomer(35),
      quantity: 1,
      paymentMethod: "cod",
      product,
    });

    const result = await createOrderRefund({
      order,
      amountInPaise: order.totalInPaise,
      reason: "COD",
      admin,
      idempotencyKey: "cod-refund",
    });
    expect(result.ok).toBe(false);
    expect(providerRefundCalls).toHaveLength(0);
  });

  it("marks the refund failed and moves no money when Razorpay rejects it", async () => {
    const admin = await seedAdmin();
    const { order } = await seedPaidOrder(36);
    providerShouldFail = true;

    const result = await createOrderRefund({
      order,
      amountInPaise: order.totalInPaise,
      reason: "Provider says no",
      admin,
      idempotencyKey: "fails",
    });

    expect(result.ok).toBe(false);
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.refundedInPaise).toBe(0);
    expect(row.status).toBe("confirmed");

    const [refundRow] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, order.id));
    expect(refundRow.status).toBe("failed");
  });
});
