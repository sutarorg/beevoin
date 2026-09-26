import "server-only";

import { randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import {
  orderEvents,
  orderItems,
  orders,
  paymentMethods,
  products,
  type Order,
  type OrderEvent,
  type OrderStatus,
  type PaymentMethod,
  type Product,
} from "@/db/schema";
import { maskName } from "./format";
import { logEvent } from "./http";
import { canTransition, STATUS_META, TIMELINE_STEPS } from "./order-status";
import {
  OutOfStockError,
  releaseInventoryForOrder,
  reserveInventoryForOrder,
  maybeAlertLowStock,
} from "./services/inventory";
import { upsertCustomerForOrder } from "./services/customers";
import { invalidateProductCache } from "./services/products";

function makeOrderNumber(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  const yymmdd = [
    String(ist.getFullYear()).slice(2),
    String(ist.getMonth() + 1).padStart(2, "0"),
    String(ist.getDate()).padStart(2, "0"),
  ].join("");
  return `BV-${yymmdd}-${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

export type CheckoutCustomer = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
};

export type NewOrderResult = {
  order: Order;
  deduplicated: boolean;
};

/**
 * Creates an order from *validated* checkout input.
 *
 * All money math happens here on the server using the authoritative product
 * row — client-supplied prices, currencies and totals are never read.
 *
 * COD orders go straight to `confirmed` and reserve inventory inside the same
 * transaction.
 * Online orders start at `pending`; inventory is only consumed once payment is
 * verified.
 */
export async function createOrder(input: {
  customer: CheckoutCustomer;
  quantity: number;
  paymentMethod: PaymentMethod;
  product: Product;
}): Promise<NewOrderResult> {
  const { customer, quantity, paymentMethod, product } = input;
  const unit =
    paymentMethod === "cod" ? product.codPriceInPaise : product.priceInPaise;
  const total = unit * quantity + product.shippingInPaise;
  const email = customer.email.toLowerCase();

  // Idempotency guard: an identical order created in the last 90s is almost
  // certainly a double-submit (double-clicked button, retried request).
  const since = new Date(Date.now() - 90_000);
  const [existing] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.phone, customer.phone),
        eq(orders.email, email),
        eq(orders.totalInPaise, total),
        eq(orders.paymentMethod, paymentMethod),
        gte(orders.createdAt, since),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (existing) return { order: existing, deduplicated: true };

  const isCod = paymentMethod === "cod";
  const lookupSecret = randomBytes(24).toString("hex");
  const placedAt = new Date();

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = makeOrderNumber();
    try {
      const order = await db.transaction(async (tx) => {
        const customerRow = await upsertCustomerForOrder(tx, {
          name: customer.name,
          email,
          phone: customer.phone,
          orderTotalInPaise: total,
          placedAt,
        });

        const [created] = await tx
          .insert(orders)
          .values({
            orderNumber,
            lookupSecret,
            customerId: customerRow.id,
            productId: product.id,
            customerName: customer.name,
            email,
            phone: customer.phone,
            addressLine1: customer.addressLine1,
            addressLine2: customer.addressLine2 || null,
            locality: customer.locality,
            city: customer.city,
            state: customer.state,
            pincode: customer.pincode,
            // Immutable snapshot — later product edits must never change this.
            productName: product.name,
            productSku: product.sku,
            quantity,
            unitPriceInPaise: unit,
            shippingInPaise: product.shippingInPaise,
            totalInPaise: total,
            paymentMethod,
            paymentStatus: "pending",
            status: isCod ? "confirmed" : "pending",
            confirmedAt: isCod ? placedAt : null,
          })
          .returning();

        await tx.insert(orderItems).values({
          orderId: created.id,
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          unitPriceInPaise: unit,
          quantity,
          totalInPaise: unit * quantity,
        });

        if (isCod) {
          await reserveInventoryForOrder(tx, {
            id: created.id,
            productId: created.productId,
            quantity: created.quantity,
            inventoryReservedAt: null,
          });
        }

        await tx.insert(orderEvents).values({
          orderId: created.id,
          previousStatus: null,
          status: created.status,
          actor: "customer",
          note: isCod
            ? "Order placed with Cash on Delivery"
            : "Order created, awaiting online payment",
        });

        return created;
      });

      if (isCod) {
        invalidateProductCache();
        // Post-commit, best-effort: never inside the order transaction.
        if (order.productId) void maybeAlertLowStock(order.productId);
      }
      return { order, deduplicated: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("orders_order_number_idx") && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate an order number");
}

export async function addOrderEvent(
  tx: Db,
  input: {
    orderId: string;
    previousStatus?: OrderStatus | null;
    status: OrderStatus;
    actor?: "system" | "customer" | "admin" | "webhook";
    actorAdminId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.insert(orderEvents).values({
    orderId: input.orderId,
    previousStatus: input.previousStatus ?? null,
    status: input.status,
    actor: input.actor ?? "system",
    actorAdminId: input.actorAdminId ?? null,
    note: input.note ?? null,
  });
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<Order | undefined> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber.toUpperCase()))
    .limit(1);
  return order;
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  return order;
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(orderEvents.createdAt);
}

/** Records that a Razorpay order was created and the customer is paying. */
export async function markPaymentInitiated(
  orderId: string,
  razorpayOrderId: string,
): Promise<Order | undefined> {
  const [updated] = await db
    .update(orders)
    .set({
      razorpayOrderId,
      status: sql`case when ${orders.status} = 'pending' then 'payment_pending' else ${orders.status} end`,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  if (updated && updated.status === "payment_pending") {
    await addOrderEvent(db, {
      orderId,
      previousStatus: "pending",
      status: "payment_pending",
      actor: "customer",
      note: "Online payment started",
    });
  }
  return updated;
}

export class OrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderTransitionError";
  }
}

export type TransitionResult = {
  order: Order;
  changed: boolean;
};

/**
 * The single, server-enforced order status machine.
 *
 * * Illegal transitions are rejected (`delivered → processing` cannot happen).
 * * The status update is a conditional UPDATE on the *expected* current
 *   status, so a double-clicked admin button performs one transition and the
 *   second call is a no-op instead of a duplicate event.
 * * Cancelling an order that had reserved stock returns that stock exactly
 *   once, inside the same transaction.
 */
export async function transitionOrderStatus(input: {
  orderId: string;
  to: OrderStatus;
  actor: "system" | "customer" | "admin" | "webhook";
  actorAdminId?: string | null;
  note?: string;
  courierName?: string | null;
  trackingId?: string | null;
}): Promise<TransitionResult> {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);
    if (!current) throw new OrderTransitionError("Order not found.");

    if (current.status === input.to) {
      return { order: current, changed: false };
    }
    if (!canTransition(current.status, input.to)) {
      throw new OrderTransitionError(
        `"${STATUS_META[current.status].label}" cannot move to "${STATUS_META[input.to].label}".`,
      );
    }
    if (input.to === "refunded") {
      throw new OrderTransitionError(
        "Refunded status is set by the refund workflow, not by a manual status change.",
      );
    }

    const now = new Date();
    const patch: Partial<typeof orders.$inferInsert> = {
      status: input.to,
      updatedAt: now,
    };
    if (input.courierName) patch.courierName = input.courierName;
    if (input.trackingId) patch.trackingId = input.trackingId;
    if (input.to === "confirmed" && !current.confirmedAt) patch.confirmedAt = now;
    if (input.to === "shipped" && !current.shippedAt) patch.shippedAt = now;
    if (input.to === "delivered" && !current.deliveredAt) patch.deliveredAt = now;
    if (input.to === "cancelled") patch.cancelledAt = now;

    const updatedRows = await tx
      .update(orders)
      .set(patch)
      .where(and(eq(orders.id, current.id), eq(orders.status, current.status)))
      .returning();

    // Lost the race — another request already moved this order.
    if (updatedRows.length === 0) {
      const [latest] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, current.id))
        .limit(1);
      return { order: latest, changed: false };
    }

    const updated = updatedRows[0];

    if (input.to === "confirmed") {
      await reserveInventoryForOrder(tx, {
        id: updated.id,
        productId: updated.productId,
        quantity: updated.quantity,
        inventoryReservedAt: current.inventoryReservedAt,
      });
    }
    if (input.to === "cancelled") {
      await releaseInventoryForOrder(
        tx,
        {
          id: updated.id,
          productId: updated.productId,
          quantity: updated.quantity,
          inventoryReservedAt: current.inventoryReservedAt,
          inventoryReleasedAt: current.inventoryReleasedAt,
        },
        "order_cancelled",
        input.actorAdminId ?? null,
      );
    }

    await addOrderEvent(tx, {
      orderId: updated.id,
      previousStatus: current.status,
      status: input.to,
      actor: input.actor,
      actorAdminId: input.actorAdminId ?? null,
      note: input.note?.trim() || STATUS_META[input.to].blurb,
    });

    return { order: updated, changed: true };
  });

  if (result.changed) {
    invalidateProductCache();
    logEvent("order_status_changed", {
      orderNumber: result.order.orderNumber,
      status: result.order.status,
      actor: input.actor,
    });
  }
  return result;
}

/** Updates courier/tracking without changing the order status. */
export async function updateFulfillmentDetails(input: {
  orderId: string;
  courierName?: string | null;
  trackingId?: string | null;
  actorAdminId: string;
}): Promise<Order | undefined> {
  const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
  if (input.courierName !== undefined)
    patch.courierName = input.courierName || null;
  if (input.trackingId !== undefined)
    patch.trackingId = input.trackingId || null;

  const [updated] = await db
    .update(orders)
    .set(patch)
    .where(eq(orders.id, input.orderId))
    .returning();
  return updated;
}

export { OutOfStockError };

/**
 * Privacy-safe order view for the public tracking API. The viewer proved they
 * know the order number *plus* one verification factor, which is not the same
 * as proving identity — so the full address, email and phone are never
 * returned and the name is masked.
 */
export function toTrackingSummary(order: Order, events: OrderEvent[]) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: STATUS_META[order.status].label,
    statusBlurb: STATUS_META[order.status].blurb,
    step: STATUS_META[order.status].step,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    placedAt: order.createdAt,
    customer: maskName(order.customerName),
    item: {
      name: order.productName,
      sku: order.productSku,
      quantity: order.quantity,
      unitPriceInPaise: order.unitPriceInPaise,
    },
    shippingInPaise: order.shippingInPaise,
    totalInPaise: order.totalInPaise,
    shipTo: {
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    courierName: order.courierName,
    trackingId: order.trackingId,
    events: events.map((e) => ({
      status: e.status,
      label: STATUS_META[e.status].label,
      note: e.note,
      at: e.createdAt,
    })),
    timeline: TIMELINE_STEPS,
  };
}

export function isValidPaymentMethod(value: string): value is PaymentMethod {
  return (paymentMethods as readonly string[]).includes(value);
}

/** Sum of stock currently held by live (non-cancelled) orders. */
export async function reservedUnitsForProduct(
  productId: string,
): Promise<number> {
  const [row] = await db
    .select({
      units: sql<number>`coalesce(sum(${orders.quantity}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.productId, productId),
        sql`${orders.inventoryReservedAt} is not null`,
        sql`${orders.inventoryReleasedAt} is null`,
        sql`${orders.status} in ('confirmed','processing','shipped','out_for_delivery')`,
      ),
    );
  return row?.units ?? 0;
}

export async function soldUnitsForProduct(productId: string): Promise<number> {
  const [row] = await db
    .select({ units: sql<number>`coalesce(sum(${orders.quantity}), 0)::int` })
    .from(orders)
    .where(
      and(eq(orders.productId, productId), eq(orders.status, "delivered")),
    );
  return row?.units ?? 0;
}

export async function productForOrder(
  order: Order,
): Promise<Product | undefined> {
  if (!order.productId) return undefined;
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, order.productId))
    .limit(1);
  return row;
}
