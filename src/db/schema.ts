import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------
 * Shared value sets
 * ---------------------------------------------------------------------- */

export const orderStatuses = [
  "pending",
  "payment_pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

/** Order-level payment summary (kept for backward compatibility with v1 data). */
export const orderPaymentStatuses = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type OrderPaymentStatus = (typeof orderPaymentStatuses)[number];

export const paymentMethods = ["cod", "online"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

/** Payment-attempt lifecycle, kept separate from the order status. */
export const paymentStatuses = [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const refundStatuses = [
  "pending",
  "processed",
  "failed",
  "cancelled",
] as const;
export type RefundStatus = (typeof refundStatuses)[number];

export const inventoryReasons = [
  "initial_stock",
  "order_reserved",
  "order_cancelled",
  "refund",
  "manual_adjustment",
  "restock",
] as const;
export type InventoryReason = (typeof inventoryReasons)[number];

export const adminRoles = ["owner", "admin", "support", "fulfillment"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminStatuses = ["active", "suspended"] as const;
export type AdminStatus = (typeof adminStatuses)[number];

export const emailDeliveryStates = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type EmailDeliveryState = (typeof emailDeliveryStates)[number];

export const contactStatuses = ["new", "read", "resolved"] as const;
export type ContactStatus = (typeof contactStatuses)[number];

export type ProductImage = { src: string; alt: string };
export type ProductSpecification = { label: string; value: string; note?: string };

const inList = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");

/* -------------------------------------------------------------------------
 * Catalogue
 * ---------------------------------------------------------------------- */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    shortName: varchar("short_name", { length: 60 }).notNull(),
    sku: varchar("sku", { length: 40 }).notNull(),
    description: text("description").notNull().default(""),
    shortDescription: varchar("short_description", { length: 320 })
      .notNull()
      .default(""),
    /** Authoritative selling price, in paise. Never a float. */
    priceInPaise: integer("price_in_paise").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    maxPerOrder: integer("max_per_order").notNull().default(5),
    shippingInPaise: integer("shipping_in_paise").notNull().default(0),
    active: boolean("active").notNull().default(true),
    inventoryQuantity: integer("inventory_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    images: jsonb("images").$type<ProductImage[]>().notNull().default([]),
    specifications: jsonb("specifications")
      .$type<ProductSpecification[]>()
      .notNull()
      .default([]),
    metadata: jsonb("metadata")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    uniqueIndex("products_sku_idx").on(t.sku),
    index("products_active_idx").on(t.active),
    check("products_price_positive", sql`${t.priceInPaise} > 0`),
    check("products_shipping_non_negative", sql`${t.shippingInPaise} >= 0`),
    check(
      "products_max_per_order_range",
      sql`${t.maxPerOrder} >= 1 and ${t.maxPerOrder} <= 20`,
    ),
    check("products_inventory_non_negative", sql`${t.inventoryQuantity} >= 0`),
    check(
      "products_low_stock_non_negative",
      sql`${t.lowStockThreshold} >= 0`,
    ),
  ],
);

/* -------------------------------------------------------------------------
 * Customers (guest shoppers — no customer logins)
 * ---------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lowercase. */
    email: varchar("email", { length: 160 }).notNull(),
    /** Normalised 10-digit Indian mobile. */
    phone: varchar("phone", { length: 10 }),
    name: varchar("name", { length: 100 }).notNull(),
    firstOrderAt: timestamp("first_order_at", { withTimezone: true }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    totalOrders: integer("total_orders").notNull().default(0),
    totalSpentInPaise: bigint("total_spent_in_paise", { mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_email_idx").on(t.email),
    index("customers_phone_idx").on(t.phone),
    index("customers_last_order_idx").on(t.lastOrderAt),
  ],
);

/* -------------------------------------------------------------------------
 * Admin identity (authorisation layer on top of Supabase Auth)
 * ---------------------------------------------------------------------- */

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Supabase Auth user id — the identity source of truth. */
    supabaseUserId: uuid("supabase_user_id").notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    name: varchar("name", { length: 100 }).notNull().default(""),
    role: varchar("role", { length: 20 }).$type<AdminRole>().notNull(),
    status: varchar("status", { length: 20 })
      .$type<AdminStatus>()
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("admin_users_supabase_user_idx").on(t.supabaseUserId),
    uniqueIndex("admin_users_email_idx").on(t.email),
    check("admin_users_role_valid", sql`${t.role} in (${sql.raw(inList(adminRoles))})`),
    check(
      "admin_users_status_valid",
      sql`${t.status} in (${sql.raw(inList(adminStatuses))})`,
    ),
  ],
);

/* -------------------------------------------------------------------------
 * Orders
 * ---------------------------------------------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-friendly ID shown to customers, e.g. BV-260203-4821. */
    orderNumber: varchar("order_number", { length: 20 }).notNull(),
    /**
     * Un-guessable token required (with the order number) to view an order.
     * Included in the order-success URL and transactional emails.
     */
    lookupSecret: varchar("lookup_secret", { length: 64 }).notNull(),

    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),

    customerName: varchar("customer_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 10 }).notNull(),

    addressLine1: varchar("address_line_1", { length: 140 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 140 }),
    locality: varchar("locality", { length: 100 }).notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    state: varchar("state", { length: 60 }).notNull(),
    pincode: varchar("pincode", { length: 6 }).notNull(),

    /** Historical snapshots — never rewritten when the product changes. */
    productName: varchar("product_name", { length: 140 }).notNull(),
    productSku: varchar("product_sku", { length: 40 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceInPaise: integer("unit_price_in_paise").notNull(),
    shippingInPaise: integer("shipping_in_paise").notNull().default(0),
    totalInPaise: integer("total_in_paise").notNull(),
    refundedInPaise: integer("refunded_in_paise").notNull().default(0),

    paymentMethod: varchar("payment_method", { length: 20 })
      .$type<PaymentMethod>()
      .notNull(),
    paymentStatus: varchar("payment_status", { length: 24 })
      .$type<OrderPaymentStatus>()
      .notNull()
      .default("pending"),
    status: varchar("status", { length: 30 })
      .$type<OrderStatus>()
      .notNull()
      .default("pending"),

    /** Kept for backward compatibility; `payments` is the detailed record. */
    razorpayOrderId: varchar("razorpay_order_id", { length: 60 }),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 60 }),

    courierName: varchar("courier_name", { length: 80 }),
    trackingId: varchar("tracking_id", { length: 80 }),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    /** Set exactly once, when stock is committed for this order. */
    inventoryCommittedAt: timestamp("inventory_committed_at", {
      withTimezone: true,
    }),
    /** Set exactly once, when reserved stock is released again. */
    inventoryReleasedAt: timestamp("inventory_released_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_order_number_idx").on(t.orderNumber),
    uniqueIndex("orders_razorpay_payment_idx").on(t.razorpayPaymentId),
    index("orders_phone_idx").on(t.phone),
    index("orders_email_idx").on(t.email),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_payment_status_idx").on(t.paymentStatus),
    index("orders_razorpay_order_idx").on(t.razorpayOrderId),
    check("orders_quantity_positive", sql`${t.quantity} > 0`),
    check("orders_total_non_negative", sql`${t.totalInPaise} >= 0`),
    check(
      "orders_refunded_within_total",
      sql`${t.refundedInPaise} >= 0 and ${t.refundedInPaise} <= ${t.totalInPaise}`,
    ),
    check(
      "orders_status_valid",
      sql`${t.status} in (${sql.raw(inList(orderStatuses))})`,
    ),
    check(
      "orders_payment_status_valid",
      sql`${t.paymentStatus} in (${sql.raw(inList(orderPaymentStatuses))})`,
    ),
    check(
      "orders_payment_method_valid",
      sql`${t.paymentMethod} in (${sql.raw(inList(paymentMethods))})`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productNameSnapshot: varchar("product_name_snapshot", {
      length: 140,
    }).notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 40 }).notNull(),
    unitPriceInPaise: integer("unit_price_in_paise").notNull(),
    quantity: integer("quantity").notNull(),
    totalInPaise: integer("total_in_paise").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("order_items_order_sku_idx").on(t.orderId, t.skuSnapshot),
    index("order_items_order_idx").on(t.orderId),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    previousStatus: varchar("previous_status", { length: 30 }).$type<OrderStatus>(),
    status: varchar("status", { length: 30 }).$type<OrderStatus>().notNull(),
    /** system | admin | webhook | customer */
    actorType: varchar("actor_type", { length: 20 }).notNull().default("system"),
    actorAdminId: uuid("actor_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    actorLabel: varchar("actor_label", { length: 120 }),
    note: text("note"),
    /** Optional idempotency key so retries don't duplicate a transition. */
    dedupeKey: varchar("dedupe_key", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("order_events_order_idx").on(t.orderId),
    uniqueIndex("order_events_dedupe_idx").on(t.dedupeKey),
  ],
);

/* -------------------------------------------------------------------------
 * Payments & refunds
 * ---------------------------------------------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull().default("razorpay"),
    providerOrderId: varchar("provider_order_id", { length: 60 }),
    providerPaymentId: varchar("provider_payment_id", { length: 60 }),
    amountInPaise: integer("amount_in_paise").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    /** upi | card | netbanking | wallet … as reported by the provider. */
    method: varchar("method", { length: 30 }),
    status: varchar("status", { length: 24 })
      .$type<PaymentStatus>()
      .notNull()
      .default("pending"),
    captured: boolean("captured").notNull().default(false),
    /** True once our server independently verified the payment. */
    verified: boolean("verified").notNull().default(false),
    amountRefundedInPaise: integer("amount_refunded_in_paise")
      .notNull()
      .default(0),
    errorCode: varchar("error_code", { length: 80 }),
    errorDescription: varchar("error_description", { length: 300 }),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_provider_payment_idx").on(
      t.provider,
      t.providerPaymentId,
    ),
    uniqueIndex("payments_open_attempt_idx")
      .on(t.provider, t.providerOrderId)
      .where(sql`provider_payment_id is null`),
    index("payments_order_idx").on(t.orderId),
    index("payments_provider_order_idx").on(t.providerOrderId),
    index("payments_status_idx").on(t.status),
    index("payments_created_idx").on(t.createdAt),
    check("payments_amount_positive", sql`${t.amountInPaise} > 0`),
    check(
      "payments_refund_within_amount",
      sql`${t.amountRefundedInPaise} >= 0 and ${t.amountRefundedInPaise} <= ${t.amountInPaise}`,
    ),
    check(
      "payments_status_valid",
      sql`${t.status} in (${sql.raw(inList(paymentStatuses))})`,
    ),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 20 }).notNull().default("razorpay"),
    providerRefundId: varchar("provider_refund_id", { length: 60 }),
    amountInPaise: integer("amount_in_paise").notNull(),
    status: varchar("status", { length: 20 })
      .$type<RefundStatus>()
      .notNull()
      .default("pending"),
    reason: varchar("reason", { length: 300 }).notNull(),
    requestedByAdminId: uuid("requested_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    /** Guards against double-submitted refund forms. */
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    error: text("error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("refunds_provider_refund_idx").on(
      t.provider,
      t.providerRefundId,
    ),
    uniqueIndex("refunds_idempotency_idx").on(t.idempotencyKey),
    index("refunds_order_idx").on(t.orderId),
    index("refunds_status_idx").on(t.status),
    index("refunds_created_idx").on(t.createdAt),
    check("refunds_amount_positive", sql`${t.amountInPaise} > 0`),
    check(
      "refunds_status_valid",
      sql`${t.status} in (${sql.raw(inList(refundStatuses))})`,
    ),
  ],
);

/* -------------------------------------------------------------------------
 * Inventory
 * ---------------------------------------------------------------------- */

export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    /** Negative = stock leaving, positive = stock returning. */
    quantityChange: integer("quantity_change").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    reason: varchar("reason", { length: 30 })
      .$type<InventoryReason>()
      .notNull(),
    actorAdminId: uuid("actor_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    note: varchar("note", { length: 300 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /** One reservation / release / refund restock per order, ever. */
    uniqueIndex("inventory_events_order_reason_idx")
      .on(t.orderId, t.reason)
      .where(sql`order_id is not null`),
    index("inventory_events_product_idx").on(t.productId),
    index("inventory_events_created_idx").on(t.createdAt),
    check("inventory_events_change_non_zero", sql`${t.quantityChange} <> 0`),
    check(
      "inventory_events_reason_valid",
      sql`${t.reason} in (${sql.raw(inList(inventoryReasons))})`,
    ),
  ],
);

/* -------------------------------------------------------------------------
 * Webhooks
 * ---------------------------------------------------------------------- */

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 20 }).notNull().default("razorpay"),
    /** Provider event id (x-razorpay-event-id) — the idempotency anchor. */
    eventId: varchar("event_id", { length: 160 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** Non-sensitive summary only — never the full payload. */
    summary: jsonb("summary")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("webhook_events_provider_event_idx").on(t.provider, t.eventId),
    index("webhook_events_created_idx").on(t.createdAt),
    index("webhook_events_type_idx").on(t.eventType),
  ],
);

/* -------------------------------------------------------------------------
 * Transactional email
 * ---------------------------------------------------------------------- */

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    template: varchar("template", { length: 40 }).notNull(),
    toEmail: varchar("to_email", { length: 160 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    /**
     * Legacy column: v1 stored the rendered HTML here. New rows keep it NULL
     * and re-render from `payload` when an email is retried, so we don't
     * warehouse customer PII.
     */
    html: text("html"),
    /** Minimal, non-sensitive data required to re-render the email. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** queued | sent | failed | skipped (skipped = no provider configured) */
    delivery: varchar("delivery", { length: 12 })
      .$type<EmailDeliveryState>()
      .notNull()
      .default("queued"),
    providerMessageId: varchar("provider_message_id", { length: 120 }),
    /** orderId + template + state version — makes sends idempotent. */
    idempotencyKey: varchar("idempotency_key", { length: 200 }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("email_logs_order_idx").on(t.orderId),
    index("email_logs_to_idx").on(t.toEmail),
    index("email_logs_created_idx").on(t.createdAt),
    index("email_logs_delivery_idx").on(t.delivery),
    uniqueIndex("email_logs_idempotency_idx").on(t.idempotencyKey),
  ],
);

/* -------------------------------------------------------------------------
 * Contact messages
 * ---------------------------------------------------------------------- */

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 10 }),
    topic: varchar("topic", { length: 40 }).notNull().default("general"),
    orderNumber: varchar("order_number", { length: 20 }),
    message: text("message").notNull(),
    /** Legacy boolean retained so v1 rows keep their meaning. */
    resolved: boolean("resolved").notNull().default(false),
    status: varchar("status", { length: 20 })
      .$type<ContactStatus>()
      .notNull()
      .default("new"),
    adminNote: varchar("admin_note", { length: 500 }),
    resolvedByAdminId: uuid("resolved_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_messages_created_idx").on(t.createdAt),
    index("contact_messages_status_idx").on(t.status),
    index("contact_messages_email_idx").on(t.email),
    check(
      "contact_messages_status_valid",
      sql`${t.status} in (${sql.raw(inList(contactStatuses))})`,
    ),
  ],
);

/* -------------------------------------------------------------------------
 * Audit log & settings
 * ---------------------------------------------------------------------- */

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    /** Snapshot so the trail survives admin deletion. */
    adminEmail: varchar("admin_email", { length: 160 }),
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    /** Never contains secrets or full customer records. */
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("admin_audit_logs_created_idx").on(t.createdAt),
    index("admin_audit_logs_admin_idx").on(t.adminUserId),
    index("admin_audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("admin_audit_logs_action_idx").on(t.action),
  ],
);

export const storeSettings = pgTable("store_settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------
 * Inferred types
 * ---------------------------------------------------------------------- */

export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type InventoryEvent = typeof inventoryEvents.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type EmailLog = typeof emailLogs.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type StoreSetting = typeof storeSettings.$inferSelect;
