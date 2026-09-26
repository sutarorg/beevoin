import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contactMessages,
  emailLogs,
  orders,
  payments,
  products,
  refunds,
  webhookEvents,
  type Order,
  type PaymentStatus,
} from "@/db/schema";

/**
 * Dashboard aggregates.
 *
 * Every number here is computed from real rows — there is no seeded or
 * decorative data anywhere in this file. Revenue counts only money we have
 * actually collected (paid online orders and delivered COD orders), minus
 * refunds, so the figure matches the bank.
 */

function istDayStart(daysAgo = 0): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - daysAgo);
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000);
}

const COLLECTED = sql`(${orders.paymentStatus} = 'paid' or (${orders.paymentMethod} = 'cod' and ${orders.status} = 'delivered'))`;

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;

export async function getDashboardMetrics() {
  const todayStart = istDayStart(0);
  const weekStart = istDayStart(6);
  const monthStart = istDayStart(29);

  const [
    today,
    week,
    month,
    lifetime,
    statusCounts,
    actionQueue,
    product,
    recent,
    alerts,
  ] = await Promise.all([
    windowStats(todayStart),
    windowStats(weekStart),
    windowStats(monthStart),
    windowStats(null),
    db
      .select({ status: orders.status, count: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({
        awaitingFulfilment: sql<number>`count(*) filter (where ${orders.status} in ('confirmed','processing'))::int`,
        inTransit: sql<number>`count(*) filter (where ${orders.status} in ('shipped','out_for_delivery'))::int`,
        paymentPending: sql<number>`count(*) filter (where ${orders.status} = 'payment_pending')::int`,
        failedPayments: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'failed')::int`,
      })
      .from(orders)
      .then((r) => r[0]),
    db
      .select()
      .from(products)
      .where(eq(products.active, true))
      .orderBy(desc(products.createdAt))
      .limit(1)
      .then((r) => r[0]),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contactMessages)
        .where(inArray(contactMessages.status, ["new", "read"]))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(eq(emailLogs.delivery, "failed"))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(webhookEvents)
        .where(eq(webhookEvents.processed, false))
        .then((r) => r[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refunds)
        .where(eq(refunds.status, "pending"))
        .then((r) => r[0]?.count ?? 0),
    ]),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) statusMap[row.status] = row.count;

  const [unresolvedMessages, failedEmails, unprocessedWebhooks, pendingRefunds] =
    alerts;

  return {
    today,
    week,
    month,
    lifetime,
    statusMap,
    queue: actionQueue,
    product,
    recent: recent as Order[],
    alerts: {
      unresolvedMessages,
      failedEmails,
      unprocessedWebhooks,
      pendingRefunds,
      lowStock: product
        ? product.inventoryQuantity <= product.lowStockThreshold
        : false,
    },
  };
}

async function windowStats(since: Date | null) {
  const conditions = since ? [gte(orders.createdAt, since)] : [];

  const [row] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      paidOrders: sql<number>`count(*) filter (where ${COLLECTED})::int`,
      units: sql<number>`coalesce(sum(${orders.quantity}) filter (where ${COLLECTED}), 0)::int`,
      grossInPaise: sql<number>`coalesce(sum(${orders.totalInPaise}) filter (where ${COLLECTED}), 0)::int`,
      refundedInPaise: sql<number>`coalesce(sum(${orders.refundedInPaise}), 0)::int`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
    })
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined);

  return {
    orders: row.orders,
    paidOrders: row.paidOrders,
    units: row.units,
    grossInPaise: row.grossInPaise,
    refundedInPaise: row.refundedInPaise,
    netInPaise: row.grossInPaise - row.refundedInPaise,
    cancelled: row.cancelled,
  };
}

/** Payment rows joined to their order, for the payments screen. */
export async function searchPayments(input: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 5), 100);
  const where =
    input.status && input.status !== "all"
      ? eq(payments.status, input.status as PaymentStatus)
      : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        payment: payments,
        orderNumber: orders.orderNumber,
        orderId: orders.id,
        customerName: orders.customerName,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return { rows, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function paymentsForOrder(orderId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt));
}
