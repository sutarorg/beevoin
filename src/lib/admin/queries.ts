import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  adminAuditLogs,
  adminUsers,
  contactMessages,
  customers,
  emailLogs,
  inventoryEvents,
  orders,
  payments,
  products,
  refunds,
  webhookEvents,
  type ContactStatus,
  type OrderStatus,
} from "@/db/schema";

/**
 * Admin list queries.
 *
 * Every list is searched, filtered, sorted AND paginated IN POSTGRES. No admin
 * page ever loads a whole table into memory and slices it in JavaScript — that
 * is the difference between a dashboard that works at 50 orders and one that
 * works at 50,000.
 */

export const PAGE_SIZE = 25;

export type Page<T> = {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
};

export function parsePage(value: string | undefined): number {
  const n = Number(value ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function paginate<T>(rows: T[], total: number, page: number): Page<T> {
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Escape LIKE wildcards so a search for "100%" doesn't match everything. */
function likeTerm(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

export type OrderFilters = {
  q?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  page?: string;
};

export async function listOrders(filters: OrderFilters) {
  const page = parsePage(filters.page);
  const clauses: SQL[] = [];

  const q = filters.q?.trim();
  if (q) {
    const term = likeTerm(q);
    const searchClause = or(
      ilike(orders.orderNumber, term),
      ilike(orders.email, term),
      ilike(orders.phone, term),
      ilike(orders.customerName, term),
      ilike(orders.razorpayPaymentId, term),
      ilike(orders.trackingId, term),
    );
    if (searchClause) clauses.push(searchClause);
  }
  if (filters.status) clauses.push(eq(orders.status, filters.status as OrderStatus));
  if (filters.paymentStatus) {
    clauses.push(sql`${orders.paymentStatus} = ${filters.paymentStatus}`);
  }
  if (filters.paymentMethod) {
    clauses.push(sql`${orders.paymentMethod} = ${filters.paymentMethod}`);
  }

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        email: orders.email,
        phone: orders.phone,
        city: orders.city,
        state: orders.state,
        quantity: orders.quantity,
        totalInPaise: orders.totalInPaise,
        refundedInPaise: orders.refundedInPaise,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(orders).where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

const REVENUE_STATUSES: OrderStatus[] = [
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export async function getDashboardMetrics() {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    [orderTotals],
    [revenue30],
    [revenue7],
    statusBreakdown,
    [pendingPayments],
    [unreadMessages],
    [failedEmails],
    [failedWebhooks],
    productRow,
    recentOrders,
  ] = await Promise.all([
    db.select({ value: count() }).from(orders),
    db
      .select({
        gross: sql<number>`coalesce(sum(${orders.totalInPaise}), 0)::int`,
        refunded: sql<number>`coalesce(sum(${orders.refundedInPaise}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, since30),
          inArray(orders.status, REVENUE_STATUSES),
        ),
      ),
    db
      .select({
        gross: sql<number>`coalesce(sum(${orders.totalInPaise}), 0)::int`,
        refunded: sql<number>`coalesce(sum(${orders.refundedInPaise}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, since7),
          inArray(orders.status, REVENUE_STATUSES),
        ),
      ),
    db
      .select({ status: orders.status, value: count() })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({ value: count() })
      .from(orders)
      .where(sql`${orders.paymentStatus} in ('created','authorized','pending') and ${orders.paymentMethod} = 'online'`),
    db
      .select({ value: count() })
      .from(contactMessages)
      .where(sql`${contactMessages.status} <> 'resolved'`),
    db
      .select({ value: count() })
      .from(emailLogs)
      .where(eq(emailLogs.delivery, "failed")),
    db
      .select({ value: count() })
      .from(webhookEvents)
      .where(eq(webhookEvents.processed, false)),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        priceInPaise: products.priceInPaise,
        codPriceInPaise: products.codPriceInPaise,
        inventoryQuantity: products.inventoryQuantity,
        lowStockThreshold: products.lowStockThreshold,
        active: products.active,
      })
      .from(products)
      .limit(1),
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        totalInPaise: orders.totalInPaise,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(8),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusBreakdown) byStatus[row.status] = row.value;

  return {
    totalOrders: orderTotals?.value ?? 0,
    revenue30: {
      net: (revenue30?.gross ?? 0) - (revenue30?.refunded ?? 0),
      gross: revenue30?.gross ?? 0,
      orders: revenue30?.orders ?? 0,
    },
    revenue7: {
      net: (revenue7?.gross ?? 0) - (revenue7?.refunded ?? 0),
      orders: revenue7?.orders ?? 0,
    },
    byStatus,
    pendingPayments: pendingPayments?.value ?? 0,
    unreadMessages: unreadMessages?.value ?? 0,
    failedEmails: failedEmails?.value ?? 0,
    unprocessedWebhooks: failedWebhooks?.value ?? 0,
    product: productRow[0] ?? null,
    recentOrders,
  };
}

/* ------------------------------------------------------------------ *
 * Payments
 * ------------------------------------------------------------------ */

export async function listPayments(filters: {
  q?: string;
  status?: string;
  page?: string;
}) {
  const page = parsePage(filters.page);
  const clauses: SQL[] = [];

  const q = filters.q?.trim();
  if (q) {
    const term = likeTerm(q);
    const searchClause = or(
      ilike(payments.providerPaymentId, term),
      ilike(payments.providerOrderId, term),
      ilike(orders.orderNumber, term),
      ilike(orders.email, term),
    );
    if (searchClause) clauses.push(searchClause);
  }
  if (filters.status) clauses.push(sql`${payments.status} = ${filters.status}`);

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        orderNumber: orders.orderNumber,
        providerPaymentId: payments.providerPaymentId,
        providerOrderId: payments.providerOrderId,
        amountInPaise: payments.amountInPaise,
        amountRefundedInPaise: payments.amountRefundedInPaise,
        currency: payments.currency,
        method: payments.method,
        status: payments.status,
        verified: payments.verified,
        captured: payments.captured,
        failureReason: payments.failureReason,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ value: count() })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

/* ------------------------------------------------------------------ *
 * Refunds
 * ------------------------------------------------------------------ */

export async function listRefunds(filters: {
  q?: string;
  status?: string;
  page?: string;
}) {
  const page = parsePage(filters.page);
  const clauses: SQL[] = [];

  const q = filters.q?.trim();
  if (q) {
    const term = likeTerm(q);
    const searchClause = or(
      ilike(refunds.providerRefundId, term),
      ilike(orders.orderNumber, term),
      ilike(orders.email, term),
    );
    if (searchClause) clauses.push(searchClause);
  }
  if (filters.status) clauses.push(sql`${refunds.status} = ${filters.status}`);

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: refunds.id,
        orderId: refunds.orderId,
        orderNumber: orders.orderNumber,
        providerRefundId: refunds.providerRefundId,
        amountInPaise: refunds.amountInPaise,
        status: refunds.status,
        reason: refunds.reason,
        error: refunds.error,
        restockRequested: refunds.restockRequested,
        requestedBy: adminUsers.email,
        createdAt: refunds.createdAt,
      })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .leftJoin(adminUsers, eq(adminUsers.id, refunds.requestedByAdminId))
      .where(where)
      .orderBy(desc(refunds.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ value: count() })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

/* ------------------------------------------------------------------ *
 * Customers
 * ------------------------------------------------------------------ */

export async function listCustomers(filters: { q?: string; page?: string }) {
  const page = parsePage(filters.page);
  const q = filters.q?.trim();
  const where = q
    ? or(
        ilike(customers.email, likeTerm(q)),
        ilike(customers.phone, likeTerm(q)),
        ilike(customers.name, likeTerm(q)),
      )
    : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.lastOrderAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(customers).where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

export async function getCustomerDetail(id: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!customer) return null;

  const customerOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      totalInPaise: orders.totalInPaise,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return { customer, orders: customerOrders };
}

/* ------------------------------------------------------------------ *
 * Messages, emails, webhooks, audit, inventory, admins
 * ------------------------------------------------------------------ */

export async function listMessages(filters: { status?: string; page?: string }) {
  const page = parsePage(filters.page);
  const where = filters.status
    ? eq(contactMessages.status, filters.status as ContactStatus)
    : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(contactMessages)
      .where(where)
      .orderBy(desc(contactMessages.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(contactMessages).where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

export async function listEmails(filters: {
  q?: string;
  delivery?: string;
  page?: string;
}) {
  const page = parsePage(filters.page);
  const clauses: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    const searchClause = or(
      ilike(emailLogs.toEmail, likeTerm(q)),
      ilike(emailLogs.subject, likeTerm(q)),
      ilike(emailLogs.template, likeTerm(q)),
    );
    if (searchClause) clauses.push(searchClause);
  }
  if (filters.delivery) {
    clauses.push(sql`${emailLogs.delivery} = ${filters.delivery}`);
  }
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: emailLogs.id,
        orderId: emailLogs.orderId,
        orderNumber: orders.orderNumber,
        template: emailLogs.template,
        toEmail: emailLogs.toEmail,
        subject: emailLogs.subject,
        delivery: emailLogs.delivery,
        attempts: emailLogs.attempts,
        error: emailLogs.error,
        providerMessageId: emailLogs.providerMessageId,
        createdAt: emailLogs.createdAt,
      })
      .from(emailLogs)
      .leftJoin(orders, eq(orders.id, emailLogs.orderId))
      .where(where)
      .orderBy(desc(emailLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ value: count() })
      .from(emailLogs)
      .leftJoin(orders, eq(orders.id, emailLogs.orderId))
      .where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

export async function listWebhookEvents(filters: {
  q?: string;
  processed?: string;
  page?: string;
}) {
  const page = parsePage(filters.page);
  const clauses: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    const searchClause = or(
      ilike(webhookEvents.eventId, likeTerm(q)),
      ilike(webhookEvents.eventType, likeTerm(q)),
    );
    if (searchClause) clauses.push(searchClause);
  }
  if (filters.processed === "true") clauses.push(eq(webhookEvents.processed, true));
  if (filters.processed === "false") clauses.push(eq(webhookEvents.processed, false));
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: webhookEvents.id,
        provider: webhookEvents.provider,
        eventId: webhookEvents.eventId,
        eventType: webhookEvents.eventType,
        processed: webhookEvents.processed,
        signatureVerified: webhookEvents.signatureVerified,
        attempts: webhookEvents.attempts,
        error: webhookEvents.error,
        orderNumber: orders.orderNumber,
        createdAt: webhookEvents.createdAt,
        processedAt: webhookEvents.processedAt,
      })
      .from(webhookEvents)
      .leftJoin(orders, eq(orders.id, webhookEvents.orderId))
      .where(where)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ value: count() })
      .from(webhookEvents)
      .leftJoin(orders, eq(orders.id, webhookEvents.orderId))
      .where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

export async function listAuditLogs(filters: {
  q?: string;
  action?: string;
  page?: string;
}) {
  const page = parsePage(filters.page);
  const clauses: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    const searchClause = or(
      ilike(adminAuditLogs.adminEmail, likeTerm(q)),
      ilike(adminAuditLogs.entityId, likeTerm(q)),
      ilike(adminAuditLogs.entityType, likeTerm(q)),
    );
    if (searchClause) clauses.push(searchClause);
  }
  if (filters.action) {
    clauses.push(sql`${adminAuditLogs.action} = ${filters.action}`);
  }
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(adminAuditLogs)
      .where(where)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(adminAuditLogs).where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, page);
}

export async function listInventoryEvents(filters: { page?: string }) {
  const page = parsePage(filters.page);
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: inventoryEvents.id,
        quantityChange: inventoryEvents.quantityChange,
        quantityAfter: inventoryEvents.quantityAfter,
        reason: inventoryEvents.reason,
        note: inventoryEvents.note,
        orderNumber: orders.orderNumber,
        actorEmail: adminUsers.email,
        createdAt: inventoryEvents.createdAt,
      })
      .from(inventoryEvents)
      .leftJoin(orders, eq(orders.id, inventoryEvents.orderId))
      .leftJoin(adminUsers, eq(adminUsers.id, inventoryEvents.actorAdminId))
      .orderBy(desc(inventoryEvents.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(inventoryEvents),
  ]);
  return paginate(rows, totals?.value ?? 0, page);
}

export async function listAdminUsers() {
  return db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
}
