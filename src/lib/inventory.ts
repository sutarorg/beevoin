import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import {
  inventoryEvents,
  orders,
  products,
  type AdminUser,
  type InventoryEvent,
  type InventoryReason,
  type Order,
} from "@/db/schema";
import { logEvent } from "./logger";

/**
 * Inventory service.
 *
 * Rules:
 *  - Stock only ever changes through this module, inside a transaction.
 *  - Reservations are conditional (`inventory_quantity >= qty`), so two
 *    concurrent checkouts can never both take the last unit.
 *  - Every movement is idempotent per order: `orders.inventory_committed_at`
 *    / `inventory_released_at` claim the operation, and a partial unique
 *    index on (order_id, reason) is the database-level backstop.
 */

export class InsufficientStockError extends Error {
  readonly available: number;
  constructor(available: number) {
    super("Not enough stock available");
    this.name = "InsufficientStockError";
    this.available = available;
  }
}

async function writeEvent(
  client: DbClient,
  input: {
    productId: string;
    orderId?: string | null;
    quantityChange: number;
    quantityAfter: number;
    reason: InventoryReason;
    actorAdminId?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client
    .insert(inventoryEvents)
    .values({
      productId: input.productId,
      orderId: input.orderId ?? null,
      quantityChange: input.quantityChange,
      quantityAfter: input.quantityAfter,
      reason: input.reason,
      actorAdminId: input.actorAdminId ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
    })
    .onConflictDoNothing();
}

/**
 * Commits stock for an order exactly once. Safe to call from the COD path,
 * the browser payment callback and the webhook — whoever gets there first
 * wins and the others are no-ops.
 */
export async function commitInventoryForOrder(
  client: DbClient,
  order: Order,
): Promise<{ committed: boolean; alreadyCommitted: boolean }> {
  if (!order.productId) {
    // Legacy order placed before the catalogue existed: nothing to reserve.
    return { committed: false, alreadyCommitted: true };
  }

  const claimed = await client
    .update(orders)
    .set({ inventoryCommittedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), isNull(orders.inventoryCommittedAt)))
    .returning({ id: orders.id });

  if (claimed.length === 0) return { committed: false, alreadyCommitted: true };

  const updated = await client
    .update(products)
    .set({
      inventoryQuantity: sql`${products.inventoryQuantity} - ${order.quantity}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, order.productId),
        gte(products.inventoryQuantity, order.quantity),
      ),
    )
    .returning({ quantity: products.inventoryQuantity });

  if (updated.length === 0) {
    const [current] = await client
      .select({ quantity: products.inventoryQuantity })
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1);
    logEvent("inventory_insufficient", {
      orderNumber: order.orderNumber,
      requested: order.quantity,
      available: current?.quantity ?? 0,
    });
    throw new InsufficientStockError(current?.quantity ?? 0);
  }

  await writeEvent(client, {
    productId: order.productId,
    orderId: order.id,
    quantityChange: -order.quantity,
    quantityAfter: updated[0].quantity,
    reason: "order_reserved",
  });

  logEvent("inventory_adjusted", {
    reason: "order_reserved",
    orderNumber: order.orderNumber,
    change: -order.quantity,
    remaining: updated[0].quantity,
  });

  return { committed: true, alreadyCommitted: false };
}

/** Returns stock to the shelf exactly once (cancellation / refund restock). */
export async function releaseInventoryForOrder(
  client: DbClient,
  order: Order,
  reason: Extract<InventoryReason, "order_cancelled" | "refund">,
  actorAdminId?: string | null,
): Promise<{ released: boolean }> {
  if (!order.productId) return { released: false };

  const claimed = await client
    .update(orders)
    .set({ inventoryReleasedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, order.id),
        isNotNull(orders.inventoryCommittedAt),
        isNull(orders.inventoryReleasedAt),
      ),
    )
    .returning({ id: orders.id });

  if (claimed.length === 0) return { released: false };

  const [updated] = await client
    .update(products)
    .set({
      inventoryQuantity: sql`${products.inventoryQuantity} + ${order.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, order.productId))
    .returning({ quantity: products.inventoryQuantity });

  await writeEvent(client, {
    productId: order.productId,
    orderId: order.id,
    quantityChange: order.quantity,
    quantityAfter: updated?.quantity ?? 0,
    reason,
    actorAdminId: actorAdminId ?? null,
  });

  logEvent("inventory_adjusted", {
    reason,
    orderNumber: order.orderNumber,
    change: order.quantity,
    remaining: updated?.quantity ?? 0,
  });

  return { released: true };
}

/** Manual admin adjustment (restock / correction). Always audited upstream. */
export async function adjustInventory(input: {
  productId: string;
  quantityChange: number;
  reason: Extract<InventoryReason, "manual_adjustment" | "restock" | "initial_stock">;
  note: string;
  admin: Pick<AdminUser, "id" | "email">;
}): Promise<{ quantityAfter: number }> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(products)
      .set({
        inventoryQuantity: sql`${products.inventoryQuantity} + ${input.quantityChange}`,
        updatedAt: new Date(),
      })
      .where(
        input.quantityChange < 0
          ? and(
              eq(products.id, input.productId),
              gte(products.inventoryQuantity, Math.abs(input.quantityChange)),
            )
          : eq(products.id, input.productId),
      )
      .returning({ quantity: products.inventoryQuantity });

    if (updated.length === 0) {
      const [current] = await tx
        .select({ quantity: products.inventoryQuantity })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      throw new InsufficientStockError(current?.quantity ?? 0);
    }

    await writeEvent(tx, {
      productId: input.productId,
      quantityChange: input.quantityChange,
      quantityAfter: updated[0].quantity,
      reason: input.reason,
      actorAdminId: input.admin.id,
      note: input.note,
    });

    logEvent("inventory_adjusted", {
      reason: input.reason,
      change: input.quantityChange,
      remaining: updated[0].quantity,
      actor: input.admin.email,
    });

    return { quantityAfter: updated[0].quantity };
  });
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

export async function inventoryTotals(productId: string) {
  const [row] = await db
    .select({
      sold: sql<number>`coalesce(-sum(case when ${inventoryEvents.reason} = 'order_reserved' then ${inventoryEvents.quantityChange} else 0 end), 0)::int`,
      returned: sql<number>`coalesce(sum(case when ${inventoryEvents.reason} in ('order_cancelled','refund') then ${inventoryEvents.quantityChange} else 0 end), 0)::int`,
      restocked: sql<number>`coalesce(sum(case when ${inventoryEvents.reason} in ('restock','initial_stock','manual_adjustment') then ${inventoryEvents.quantityChange} else 0 end), 0)::int`,
    })
    .from(inventoryEvents)
    .where(eq(inventoryEvents.productId, productId));
  return row ?? { sold: 0, returned: 0, restocked: 0 };
}
