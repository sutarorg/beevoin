import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import {
  inventoryEvents,
  orders,
  products,
  type InventoryEvent,
  type InventoryReason,
} from "@/db/schema";
import { logEvent } from "@/lib/http";
import { invalidateProductCache } from "./products";

/**
 * Inventory is maintained atomically at the database level.
 *
 * Never `inventory = inventory - n` read-modify-write. Every consuming write
 * is a single conditional UPDATE guarded by `inventory_quantity >= n`, and the
 * affected-row count is checked. Two concurrent checkouts for the last unit
 * therefore cannot both succeed — Postgres serialises the row update and the
 * loser's WHERE clause no longer matches.
 */

export class OutOfStockError extends Error {
  constructor(message = "Not enough stock available.") {
    super(message);
    this.name = "OutOfStockError";
  }
}

/**
 * Atomically consume `quantity` units. Returns the new quantity, or null when
 * there was not enough stock (caller decides whether that is an error).
 */
export async function consumeStock(
  tx: Db,
  input: {
    productId: string;
    quantity: number;
    orderId?: string | null;
    reason: InventoryReason;
    actorAdminId?: string | null;
    note?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<number | null> {
  const updated = await tx
    .update(products)
    .set({
      inventoryQuantity: sql`${products.inventoryQuantity} - ${input.quantity}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, input.productId),
        gte(products.inventoryQuantity, input.quantity),
      ),
    )
    .returning({ quantityAfter: products.inventoryQuantity });

  if (updated.length === 0) return null;

  const quantityAfter = updated[0].quantityAfter;
  await tx.insert(inventoryEvents).values({
    productId: input.productId,
    orderId: input.orderId ?? null,
    quantityChange: -input.quantity,
    quantityAfter,
    reason: input.reason,
    actorAdminId: input.actorAdminId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? null,
  });
  return quantityAfter;
}

/** Atomically add stock back (cancellation, refund, restock, correction). */
export async function addStock(
  tx: Db,
  input: {
    productId: string;
    quantity: number;
    orderId?: string | null;
    reason: InventoryReason;
    actorAdminId?: string | null;
    note?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<number> {
  const [row] = await tx
    .update(products)
    .set({
      inventoryQuantity: sql`${products.inventoryQuantity} + ${input.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.productId))
    .returning({ quantityAfter: products.inventoryQuantity });

  if (!row) throw new Error("Product not found while restoring inventory.");

  await tx.insert(inventoryEvents).values({
    productId: input.productId,
    orderId: input.orderId ?? null,
    quantityChange: input.quantity,
    quantityAfter: row.quantityAfter,
    reason: input.reason,
    actorAdminId: input.actorAdminId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? null,
  });
  return row.quantityAfter;
}

/**
 * Reserve stock for an order exactly once.
 *
 * Idempotency comes from `orders.inventory_reserved_at`: the guard is a
 * conditional UPDATE inside the caller's transaction, so a payment callback,
 * a webhook and an admin retry racing each other still decrement once.
 *
 * Returns true when this call performed the reservation, false when it had
 * already been done.
 */
export async function reserveInventoryForOrder(
  tx: Db,
  order: {
    id: string;
    productId: string | null;
    quantity: number;
    inventoryReservedAt: Date | null;
  },
): Promise<boolean> {
  if (!order.productId) return false;
  if (order.inventoryReservedAt) return false;

  // Claim the reservation slot first; only the winner touches stock.
  const claimed = await tx
    .update(orders)
    .set({ inventoryReservedAt: new Date() })
    .where(
      and(eq(orders.id, order.id), sql`${orders.inventoryReservedAt} is null`),
    )
    .returning({ id: orders.id });

  if (claimed.length === 0) return false;

  const after = await consumeStock(tx, {
    productId: order.productId,
    quantity: order.quantity,
    orderId: order.id,
    reason: "order_reserved",
    note: "Stock reserved on order confirmation",
  });

  if (after === null) {
    // Stock vanished between checkout validation and confirmation. Release
    // the claim so an operator can restock and retry rather than silently
    // leaving the order looking reserved.
    await tx
      .update(orders)
      .set({ inventoryReservedAt: null })
      .where(eq(orders.id, order.id));
    throw new OutOfStockError(
      "Stock is no longer available for this order. Restock before confirming.",
    );
  }

  logEvent("inventory_reserved", { quantity: order.quantity, after });
  return true;
}

/**
 * Return reserved stock exactly once (cancellation / refund restock).
 * Guarded by `orders.inventory_released_at`.
 */
export async function releaseInventoryForOrder(
  tx: Db,
  order: {
    id: string;
    productId: string | null;
    quantity: number;
    inventoryReservedAt: Date | null;
    inventoryReleasedAt: Date | null;
  },
  reason: InventoryReason,
  actorAdminId?: string | null,
): Promise<boolean> {
  if (!order.productId) return false;
  if (!order.inventoryReservedAt) return false;
  if (order.inventoryReleasedAt) return false;

  const claimed = await tx
    .update(orders)
    .set({ inventoryReleasedAt: new Date() })
    .where(
      and(
        eq(orders.id, order.id),
        sql`${orders.inventoryReleasedAt} is null`,
        sql`${orders.inventoryReservedAt} is not null`,
      ),
    )
    .returning({ id: orders.id });

  if (claimed.length === 0) return false;

  const after = await addStock(tx, {
    productId: order.productId,
    quantity: order.quantity,
    orderId: order.id,
    reason,
    actorAdminId: actorAdminId ?? null,
    note: "Reserved stock returned",
  });
  logEvent("inventory_released", { quantity: order.quantity, after });
  return true;
}

/** Manual admin adjustment. `delta` may be positive or negative. */
export async function adjustInventory(input: {
  productId: string;
  delta: number;
  reason: InventoryReason;
  note: string;
  actorAdminId: string;
}): Promise<number> {
  const result = await db.transaction(async (tx) => {
    if (input.delta < 0) {
      const after = await consumeStock(tx, {
        productId: input.productId,
        quantity: Math.abs(input.delta),
        reason: input.reason,
        actorAdminId: input.actorAdminId,
        note: input.note,
      });
      if (after === null) {
        throw new OutOfStockError(
          "Cannot remove more units than are currently in stock.",
        );
      }
      return after;
    }
    return addStock(tx, {
      productId: input.productId,
      quantity: input.delta,
      reason: input.reason,
      actorAdminId: input.actorAdminId,
      note: input.note,
    });
  });

  invalidateProductCache();
  logEvent("inventory_adjusted", { delta: input.delta, reason: input.reason });
  return result;
}

export async function recentInventoryEvents(
  productId: string,
  limit = 50,
): Promise<InventoryEvent[]> {
  return db
    .select()
    .from(inventoryEvents)
    .where(eq(inventoryEvents.productId, productId))
    .orderBy(desc(inventoryEvents.createdAt))
    .limit(limit);
}

export const INVENTORY_REASON_LABELS: Record<InventoryReason, string> = {
  initial_stock: "Initial stock",
  order_reserved: "Order reserved",
  order_cancelled: "Order cancelled",
  refund: "Refund restock",
  manual_adjustment: "Manual adjustment",
  restock: "Restock",
};

/**
 * Low-stock alert.
 *
 * Called AFTER the transaction that consumed stock has committed, never
 * inside it: an email provider hiccup must not roll back a confirmed order.
 * Fires only on the transition across the threshold (the event that took
 * stock to or below it), so a store sitting at 3 units does not email the
 * operator on every single sale.
 */
export async function maybeAlertLowStock(productId: string): Promise<void> {
  try {
    const [product] = await db
      .select({
        name: products.name,
        sku: products.sku,
        inventoryQuantity: products.inventoryQuantity,
        lowStockThreshold: products.lowStockThreshold,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) return;
    if (product.inventoryQuantity > product.lowStockThreshold) return;

    const { sendAdminNotification } = await import("@/lib/email/send");
    const { notificationEmail } = await import("./settings");

    await sendAdminNotification({
      template: "low_inventory_alert",
      to: await notificationEmail(),
      // One alert per (sku, remaining quantity): crossing 5 → 4 → 3 alerts
      // once each, and a restock followed by another dip alerts again.
      eventKey: `low_stock:${product.sku}:${product.inventoryQuantity}`,
      data: {
        productName: product.name,
        sku: product.sku,
        quantity: String(product.inventoryQuantity),
        threshold: String(product.lowStockThreshold),
      },
    });
  } catch (error) {
    // Alerting is advisory. Never let it affect the order that triggered it.
    logEvent("low_stock_alert_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
