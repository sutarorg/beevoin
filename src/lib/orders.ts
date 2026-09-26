import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import {
  customers,
  orderEvents,
  orderItems,
  orders,
  type AdminUser,
  type Order,
  type OrderEvent,
  type OrderStatus,
  type PaymentMethod,
  type Product,
} from "@/db/schema";
import {
  refreshCustomerAggregates,
  normaliseEmail,
  upsertCustomerForOrder,
} from "./customers";
import { commitInventoryForOrder, releaseInventoryForOrder } from "./inventory";
import { maskName } from "./format";
import { logEvent } from "./logger";
import { canTransition, STATUS_META, TIMELINE_STEPS } from "./order-status";
import { orderTotalInPaise } from "./product-view";

/* -------------------------------------------------------------------------
 * Order numbers
 * ---------------------------------------------------------------------- */

export function makeOrderNumber(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  const yymmdd = [
    String(ist.getFullYear()).slice(2),
    String(ist.getMonth() + 1).padStart(2, "0"),
    String(ist.getDate()).padStart(2, "0"),
  ].join("");
  return `BV-${yymmdd}-${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

/* -------------------------------------------------------------------------
 * Creation
 * ---------------------------------------------------------------------- */

export type OrderActor =
  | { type: "system"; label?: string }
  | { type: "customer"; label?: string }
  | { type: "webhook"; label?: string }
  | { type: "admin"; admin: Pick<AdminUser, "id" | "email">; label?: string };

function actorFields(actor: OrderActor) {
  return {
    actorType: actor.type,
    actorAdminId: actor.type === "admin" ? actor.admin.id : null,
    actorLabel:
      actor.type === "admin" ? actor.admin.email : (actor.label ?? null),
  };
}

export async function addOrderEvent(
  client: DbClient,
  input: {
    orderId: string;
    status: OrderStatus;
    previousStatus?: OrderStatus | null;
    note?: string | null;
    actor: OrderActor;
    dedupeKey?: string | null;
  },
): Promise<boolean> {
  const inserted = await client
    .insert(orderEvents)
    .values({
      orderId: input.orderId,
      status: input.status,
      previousStatus: input.previousStatus ?? null,
      note: input.note ?? null,
      dedupeKey: input.dedupeKey ?? null,
      ...actorFields(input.actor),
    })
    .onConflictDoNothing()
    .returning({ id: orderEvents.id });
  return inserted.length > 0;
}

export type CreateOrderInput = {
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
  /** Authoritative product row, read from the database moments earlier. */
  product: Product;
};

export type NewOrderResult = { order: Order; deduplicated: boolean };

/**
 * Creates an order from validated checkout input.
 *
 * All money is computed here from the product row — client-supplied prices,
 * totals and currencies are ignored entirely. The order, its line item and
 * the customer directory entry are written in one transaction.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<NewOrderResult> {
  const { customer, quantity, paymentMethod, product } = input;
  const unit = product.priceInPaise;
  const shipping = product.shippingInPaise;
  const total = orderTotalInPaise({
    unitPriceInPaise: unit,
    quantity,
    shippingInPaise: shipping,
  });
  const email = normaliseEmail(customer.email);

  // Double-submit guard: an identical order created seconds ago is a retry,
  // not a second purchase.
  const since = new Date(Date.now() - 90_000);
  const [recent] = await db
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
  if (recent) return { order: recent, deduplicated: true };

  const lookupSecret = randomBytes(24).toString("hex");

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = makeOrderNumber();
    try {
      return await db.transaction(async (tx) => {
        const customerRow = await upsertCustomerForOrder(tx, {
          email,
          phone: customer.phone,
          name: customer.name,
        });

        const [order] = await tx
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
            productName: product.name,
            productSku: product.sku,
            quantity,
            unitPriceInPaise: unit,
            shippingInPaise: shipping,
            totalInPaise: total,
            paymentMethod,
            paymentStatus: "pending",
            status: "pending",
          })
          .returning();

        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          unitPriceInPaise: unit,
          quantity,
          totalInPaise: unit * quantity,
        });

        await addOrderEvent(tx, {
          orderId: order.id,
          status: "pending",
          note:
            paymentMethod === "cod"
              ? "Order placed with Cash on Delivery"
              : "Order created, awaiting online payment",
          actor: { type: "customer" },
          dedupeKey: `${order.id}:created`,
        });

        await refreshCustomerAggregates(tx, customerRow.id);

        return { order, deduplicated: false };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("orders_order_number_idx") && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate an order number");
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

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
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return order;
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.createdAt));
}

export async function getOrderItems(orderId: string) {
  return db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt));
}

/* -------------------------------------------------------------------------
 * Transitions
 * ---------------------------------------------------------------------- */

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Cannot move an order from “${STATUS_META[from].label}” to “${STATUS_META[to].label}”.`,
    );
    this.name = "InvalidTransitionError";
  }
}

function statusTimestamps(status: OrderStatus): Partial<typeof orders.$inferInsert> {
  const now = new Date();
  switch (status) {
    case "confirmed":
      return { confirmedAt: now };
    case "shipped":
      return { shippedAt: now };
    case "delivered":
      return { deliveredAt: now };
    case "cancelled":
      return { cancelledAt: now };
    default:
      return {};
  }
}

export type TransitionInput = {
  orderId: string;
  to: OrderStatus;
  actor: OrderActor;
  note?: string | null;
  dedupeKey?: string | null;
  courierName?: string | null;
  trackingId?: string | null;
  /** Set by the payment layer when money state changes with the status. */
  paymentStatus?: Order["paymentStatus"];
  /** Skip the state-machine check for system-driven payment confirmations. */
  allowSameStatus?: boolean;
};

export type TransitionResult = {
  order: Order;
  changed: boolean;
  eventCreated: boolean;
};

/**
 * The only way an order status ever changes. Validates the transition,
 * updates stock when needed and records exactly one timeline event.
 */
export async function transitionOrder(
  input: TransitionInput,
  client?: DbClient,
): Promise<TransitionResult> {
  const run = async (tx: DbClient): Promise<TransitionResult> => {
    // Lock the row so concurrent callers (callback + webhook) serialise.
    const [current] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");

    if (!current) throw new Error("Order not found");

    if (current.status === input.to) {
      // Idempotent no-op: the desired state is already in place.
      const eventCreated = input.dedupeKey
        ? await addOrderEvent(tx, {
            orderId: current.id,
            status: input.to,
            previousStatus: current.status,
            note: input.note ?? null,
            actor: input.actor,
            dedupeKey: input.dedupeKey,
          })
        : false;
      return { order: current, changed: false, eventCreated };
    }

    if (!canTransition(current.status, input.to)) {
      throw new InvalidTransitionError(current.status, input.to);
    }

    const patch: Partial<typeof orders.$inferInsert> = {
      status: input.to,
      updatedAt: new Date(),
      ...statusTimestamps(input.to),
    };
    if (input.courierName) patch.courierName = input.courierName;
    if (input.trackingId) patch.trackingId = input.trackingId;
    if (input.paymentStatus) patch.paymentStatus = input.paymentStatus;

    // Stock: commit on confirmation, return it on cancellation.
    if (input.to === "confirmed") {
      await commitInventoryForOrder(tx, current);
    } else if (input.to === "cancelled") {
      await releaseInventoryForOrder(
        tx,
        current,
        "order_cancelled",
        input.actor.type === "admin" ? input.actor.admin.id : null,
      );
    }

    const [updated] = await tx
      .update(orders)
      .set(patch)
      .where(eq(orders.id, current.id))
      .returning();

    const eventCreated = await addOrderEvent(tx, {
      orderId: current.id,
      status: input.to,
      previousStatus: current.status,
      note: input.note ?? STATUS_META[input.to].blurb,
      actor: input.actor,
      dedupeKey: input.dedupeKey ?? `${current.id}:${input.to}:${Date.now()}`,
    });

    if (updated.customerId) {
      await refreshCustomerAggregates(tx, updated.customerId);
    }

    logEvent("order_status_changed", {
      orderNumber: updated.orderNumber,
      from: current.status,
      to: updated.status,
      actor: input.actor.type,
    });

    return { order: updated, changed: true, eventCreated };
  };

  return client ? run(client) : db.transaction(run);
}

/** Courier / tracking updates that don't change the order status. */
export async function updateFulfillment(input: {
  orderId: string;
  courierName?: string | null;
  trackingId?: string | null;
  admin: Pick<AdminUser, "id" | "email">;
}): Promise<Order | undefined> {
  const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
  if (input.courierName !== undefined) patch.courierName = input.courierName || null;
  if (input.trackingId !== undefined) patch.trackingId = input.trackingId || null;

  const [updated] = await db
    .update(orders)
    .set(patch)
    .where(eq(orders.id, input.orderId))
    .returning();
  return updated;
}

/* -------------------------------------------------------------------------
 * Admin search
 * ---------------------------------------------------------------------- */

export type OrderSearchInput = {
  query?: string;
  status?: OrderStatus | "all";
  payment?: "cod" | "online" | "paid" | "unpaid" | "all";
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "amount";
  page?: number;
  pageSize?: number;
};

export async function searchOrders(input: OrderSearchInput) {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 5), 100);
  const filters = [];

  const term = input.query?.trim();
  if (term) {
    const pattern = `%${term.toLowerCase()}%`;
    filters.push(
      or(
        sql`lower(${orders.orderNumber}) like ${pattern}`,
        sql`lower(${orders.customerName}) like ${pattern}`,
        sql`lower(${orders.email}) like ${pattern}`,
        sql`${orders.phone} like ${pattern}`,
        sql`lower(coalesce(${orders.trackingId}, '')) like ${pattern}`,
      ),
    );
  }
  if (input.status && input.status !== "all") {
    filters.push(eq(orders.status, input.status));
  }
  if (input.payment && input.payment !== "all") {
    if (input.payment === "cod" || input.payment === "online") {
      filters.push(eq(orders.paymentMethod, input.payment));
    } else if (input.payment === "paid") {
      filters.push(eq(orders.paymentStatus, "paid"));
    } else {
      filters.push(sql`${orders.paymentStatus} <> 'paid'`);
    }
  }
  if (input.from) {
    const fromDate = new Date(`${input.from}T00:00:00+05:30`);
    if (!Number.isNaN(fromDate.valueOf())) filters.push(gte(orders.createdAt, fromDate));
  }
  if (input.to) {
    const toDate = new Date(`${input.to}T23:59:59+05:30`);
    if (!Number.isNaN(toDate.valueOf())) filters.push(lte(orders.createdAt, toDate));
  }

  const where = filters.length ? and(...filters) : undefined;
  const orderBy =
    input.sort === "oldest"
      ? asc(orders.createdAt)
      : input.sort === "amount"
        ? desc(orders.totalInPaise)
        : desc(orders.createdAt);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return { rows, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function ordersForCustomer(customerId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(100);
}

export async function customerForOrder(order: Order) {
  if (!order.customerId) return undefined;
  const [row] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, order.customerId))
    .limit(1);
  return row;
}

/* -------------------------------------------------------------------------
 * Customer-facing projection
 * ---------------------------------------------------------------------- */

/**
 * Privacy-safe order view for the tracking API: no address lines, no email,
 * no phone — only what the buyer needs to follow the parcel.
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
    refundedInPaise: order.refundedInPaise,
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
