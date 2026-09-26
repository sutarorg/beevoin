import { randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderEvents,
  orders,
  paymentMethods,
  type Order,
  type OrderEvent,
  type OrderStatus,
  type PaymentMethod,
} from "@/db/schema";
import { product } from "./config";
import { maskName } from "./format";
import { STATUS_META, TIMELINE_STEPS } from "./order-status";

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

export type NewOrderResult = {
  order: Order;
  deduplicated: boolean;
};

/**
 * Creates an order from *validated* checkout input. All money math happens
 * here on the server — client-provided prices are never trusted.
 */
export async function createOrder(input: {
  customer: {
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
  quantity: number;
  paymentMethod: PaymentMethod;
  razorpayOrderId?: string;
}): Promise<NewOrderResult> {
  const { customer, quantity, paymentMethod } = input;
  const unit = product.priceInPaise;
  const total = unit * quantity + product.shippingInPaise;

  // Idempotency guard: an identical COD order created in the last 90s is
  // almost certainly a double-submit — return the original instead.
  if (paymentMethod === "cod") {
    const since = new Date(Date.now() - 90_000);
    const [existing] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.phone, customer.phone),
          eq(orders.email, customer.email.toLowerCase()),
          eq(orders.totalInPaise, total),
          eq(orders.paymentMethod, "cod"),
          gte(orders.createdAt, since),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);
    if (existing) return { order: existing, deduplicated: true };
  }

  const isCod = paymentMethod === "cod";
  const lookupSecret = randomBytes(24).toString("hex");

  // Retry order-number generation on the rare unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = makeOrderNumber();
    try {
      const [order] = await db
        .insert(orders)
        .values({
          orderNumber,
          lookupSecret,
          customerName: customer.name,
          email: customer.email.toLowerCase(),
          phone: customer.phone,
          addressLine1: customer.addressLine1,
          addressLine2: customer.addressLine2 || null,
          locality: customer.locality,
          city: customer.city,
          state: customer.state,
          pincode: customer.pincode,
          productName: product.name,
          productSku: product.sku,
          quantity,
          unitPriceInPaise: unit,
          shippingInPaise: product.shippingInPaise,
          totalInPaise: total,
          paymentMethod,
          paymentStatus: "pending",
          status: isCod ? "confirmed" : "pending",
          razorpayOrderId: input.razorpayOrderId ?? null,
        })
        .returning();

      await addOrderEvent(
        order.id,
        order.status,
        isCod
          ? "Order placed with Cash on Delivery"
          : "Order created, awaiting online payment",
      );
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
  orderId: string,
  status: OrderStatus,
  note?: string,
) {
  await db.insert(orderEvents).values({ orderId, status, note });
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

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(orderEvents.createdAt);
}

export async function markOrderPaid(
  order: Order,
  razorpayPaymentId: string,
): Promise<Order> {
  const [updated] = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "confirmed",
      razorpayPaymentId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id))
    .returning();
  await addOrderEvent(order.id, "confirmed", "Online payment received");
  return updated;
}

export async function markOrderPaymentFailed(order: Order): Promise<void> {
  await db
    .update(orders)
    .set({ paymentStatus: "failed", updatedAt: new Date() })
    .where(eq(orders.id, order.id));
}

export async function updateOrderStatus(input: {
  orderId: string;
  status: OrderStatus;
  courierName?: string;
  trackingId?: string;
  note?: string;
}): Promise<Order | undefined> {
  const patch: Partial<typeof orders.$inferInsert> = {
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.courierName !== undefined && input.courierName !== "")
    patch.courierName = input.courierName;
  if (input.trackingId !== undefined && input.trackingId !== "")
    patch.trackingId = input.trackingId;
  if (input.status === "refunded") patch.paymentStatus = "refunded";
  if (input.status === "cancelled" && input.note === undefined)
    patch.status = "cancelled";

  const [updated] = await db
    .update(orders)
    .set(patch)
    .where(eq(orders.id, input.orderId))
    .returning();
  if (updated) {
    await addOrderEvent(
      input.orderId,
      input.status,
      input.note || STATUS_META[input.status].blurb,
    );
  }
  return updated;
}

/** Privacy-safe order view for the tracking API (viewer is OTP-less, so only
 * expose what's needed and mask identity fields). */
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

export function isValidPaymentMethod(
  value: string,
): value is PaymentMethod {
  return (paymentMethods as readonly string[]).includes(value);
}
