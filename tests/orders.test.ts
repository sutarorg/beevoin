import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryEvents, orderEvents, orders, products } from "@/db/schema";
import { InsufficientStockError } from "@/lib/inventory";
import {
  createOrder,
  InvalidTransitionError,
  makeOrderNumber,
  transitionOrder,
  searchOrders,
} from "@/lib/orders";
import {
  createTestProduct,
  hasDatabase,
  resetDatabase,
  uniqueCustomer,
} from "./helpers";

const suite = hasDatabase ? describe : describe.skip;

describe("order numbers", () => {
  it("look like BV-YYMMDD-NNNN", () => {
    expect(makeOrderNumber()).toMatch(/^BV-\d{6}-\d{4}$/);
  });

  it("are effectively unique across a burst", () => {
    const seen = new Set(Array.from({ length: 500 }, () => makeOrderNumber()));
    // 4 random digits: a handful of collisions in 500 draws is expected, and
    // the database retry loop handles them. Anything below 400 unique values
    // would mean the generator is not random enough.
    expect(seen.size).toBeGreaterThan(400);
  });
});

suite("orders against a real database", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("prices the order from the product row, not the request", async () => {
    const product = await createTestProduct({ priceInPaise: 149900 });
    const { order } = await createOrder({
      customer: uniqueCustomer(1),
      quantity: 2,
      paymentMethod: "cod",
      product,
    });

    expect(order.unitPriceInPaise).toBe(149900);
    expect(order.totalInPaise).toBe(299800);
    expect(order.shippingInPaise).toBe(0);
    expect(order.status).toBe("pending");
    expect(order.paymentStatus).toBe("pending");
    expect(order.lookupSecret).toHaveLength(48);
  });

  it("treats an identical repeat submission as the same order", async () => {
    const product = await createTestProduct();
    const customer = uniqueCustomer(2);

    const first = await createOrder({
      customer,
      quantity: 1,
      paymentMethod: "cod",
      product,
    });
    const second = await createOrder({
      customer,
      quantity: 1,
      paymentMethod: "cod",
      product,
    });

    expect(second.deduplicated).toBe(true);
    expect(second.order.id).toBe(first.order.id);
  });

  it("commits stock exactly once, however many times confirm runs", async () => {
    const product = await createTestProduct({ inventoryQuantity: 10 });
    const { order } = await createOrder({
      customer: uniqueCustomer(3),
      quantity: 3,
      paymentMethod: "cod",
      product,
    });

    await transitionOrder({
      orderId: order.id,
      to: "confirmed",
      actor: { type: "system", label: "test" },
      dedupeKey: `${order.id}:confirm`,
    });
    const repeat = await transitionOrder({
      orderId: order.id,
      to: "confirmed",
      actor: { type: "system", label: "test" },
      dedupeKey: `${order.id}:confirm`,
    });

    expect(repeat.changed).toBe(false);

    const [after] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(after.inventoryQuantity).toBe(7);

    const events = await db
      .select()
      .from(inventoryEvents)
      .where(eq(inventoryEvents.productId, product.id));
    expect(events).toHaveLength(1);
    expect(events[0].quantityChange).toBe(-3);
  });

  it("never oversells the last units", async () => {
    const product = await createTestProduct({ inventoryQuantity: 2 });

    const a = await createOrder({
      customer: uniqueCustomer(4),
      quantity: 2,
      paymentMethod: "cod",
      product,
    });
    const b = await createOrder({
      customer: uniqueCustomer(5),
      quantity: 2,
      paymentMethod: "cod",
      product,
    });

    await transitionOrder({
      orderId: a.order.id,
      to: "confirmed",
      actor: { type: "system", label: "test" },
    });

    await expect(
      transitionOrder({
        orderId: b.order.id,
        to: "confirmed",
        actor: { type: "system", label: "test" },
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    const [after] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(after.inventoryQuantity).toBe(0);
  });

  it("returns stock to the shelf on cancellation, exactly once", async () => {
    const product = await createTestProduct({ inventoryQuantity: 5 });
    const { order } = await createOrder({
      customer: uniqueCustomer(6),
      quantity: 2,
      paymentMethod: "cod",
      product,
    });

    await transitionOrder({
      orderId: order.id,
      to: "confirmed",
      actor: { type: "system", label: "test" },
    });
    await transitionOrder({
      orderId: order.id,
      to: "cancelled",
      actor: { type: "system", label: "test" },
      note: "Customer changed their mind",
    });

    const [after] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(after.inventoryQuantity).toBe(5);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.inventoryReleasedAt).not.toBeNull();
    expect(row.cancelledAt).not.toBeNull();
  });

  it("rejects transitions the machine does not allow", async () => {
    const product = await createTestProduct();
    const { order } = await createOrder({
      customer: uniqueCustomer(7),
      quantity: 1,
      paymentMethod: "cod",
      product,
    });

    await expect(
      transitionOrder({
        orderId: order.id,
        to: "delivered",
        actor: { type: "admin", admin: { id: crypto.randomUUID(), email: "a@b.c" } },
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("writes one timeline event per real transition", async () => {
    const product = await createTestProduct();
    const { order } = await createOrder({
      customer: uniqueCustomer(8),
      quantity: 1,
      paymentMethod: "cod",
      product,
    });

    await transitionOrder({
      orderId: order.id,
      to: "confirmed",
      actor: { type: "system", label: "test" },
    });
    await transitionOrder({
      orderId: order.id,
      to: "processing",
      actor: { type: "system", label: "test" },
    });

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id));
    expect(events.map((e) => e.status)).toEqual([
      "pending",
      "confirmed",
      "processing",
    ]);
  });

  it("searches and paginates on the server", async () => {
    const product = await createTestProduct({ inventoryQuantity: 50 });
    for (let i = 0; i < 6; i++) {
      await createOrder({
        customer: uniqueCustomer(100 + i),
        quantity: 1,
        paymentMethod: i % 2 === 0 ? "cod" : "online",
        product,
      });
    }

    const page1 = await searchOrders({ pageSize: 5, page: 1 });
    expect(page1.rows).toHaveLength(5);
    expect(page1.total).toBe(6);
    expect(page1.pages).toBe(2);

    const cod = await searchOrders({ payment: "cod" });
    expect(cod.total).toBe(3);

    const byEmail = await searchOrders({ query: "buyer100@example.com" });
    expect(byEmail.total).toBe(1);
  });
});
