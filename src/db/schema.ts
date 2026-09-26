import { sql } from "drizzle-orm";
import {
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

/* ------------------------------------------------------------------ *
 * Shared enums (string unions kept in-app; DB uses varchar + CHECK so
 * adding a value later never needs an ALTER TYPE on a live database).
 * ------------------------------------------------------------------ */

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

/**
 * Order-level payment summary. `paid` is retained (rather than renamed to
 * `captured`) because existing production rows already use it.
 */
export const paymentStatuses = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

/** Payment-entity lifecycle — deliberately separate from order status. */
export const paymentRecordStatuses = [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentRecordStatus = (typeof paymentRecordStatuses)[number];

export const paymentMethods = ["cod", "online"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const adminRoles = ["owner", "admin", "support", "fulfillment"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminStatuses = ["active", "suspended"] as const;
export type AdminStatus = (typeof adminStatuses)[number];

export const inventoryReasons = [
  "initial_stock",
  "order_reserved",
  "order_cancelled",
  "refund",
  "manual_adjustment",
  "restock",
] as const;
export type InventoryReason = (typeof inventoryReasons)[number];

export const refundStatuses = [
  "pending",
  "processed",
  "failed",
  "cancelled",
] as const;
export type RefundStatus = (typeof refundStatuses)[number];

export const emailDeliveryStates = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type EmailDelivery = (typeof emailDeliveryStates)[number];

export const contactStatuses = ["new", "read", "resolved"] as const;
export type ContactStatus = (typeof contactStatuses)[number];

/* ------------------------------------------------------------------ *
 * Products — the authoritative commercial source of truth.
 * ------------------------------------------------------------------ */

export type ProductImage = { src: string; alt: string };
export type ProductSpecification = { label: string; value: string };

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    shortName: varchar("short_name", { length: 60 }).notNull(),
    sku: varchar("sku", { length: 40 }).notNull(),
    description: text("description").notNull().default(""),
    shortDescription: varchar("short_description", { length: 300 })
      .notNull()
      .default(""),
    /** Online-payment unit price in integer paise. ₹999 === 99900. */
    priceInPaise: integer("price_in_paise").notNull(),
    /** COD unit price in integer paise. ₹1,299 === 129900. */
    codPriceInPaise: integer("cod_price_in_paise").notNull().default(129_900),
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
    metaTitle: varchar("meta_title", { length: 160 }),
    metaDescription: varchar("meta_description", { length: 320 }),
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
    check("products_price_positive", sql`${t.priceInPaise} > 0`),
    check("products_cod_price_positive", sql`${t.codPriceInPaise} > 0`),
    check("products_shipping_non_negative", sql`${t.shippingInPaise} >= 0`),
    check("products_inventory_non_negative", sql`${t.inventoryQuantity} >= 0`),
    check("products_max_per_order_positive", sql`${t.maxPerOrder} > 0`),
  ],
);

/* ------------------------------------------------------------------ *
 * Customers — guest shoppers, de-duplicated on normalised email.
 * ------------------------------------------------------------------ */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 10 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    firstOrderAt: timestamp("first_order_at", { withTimezone: true }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    totalOrders: integer("total_orders").notNull().default(0),
    totalSpentInPaise: integer("total_spent_in_paise").notNull().default(0),
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

/* ------------------------------------------------------------------ *
 * Orders — historical snapshots are immutable by design.
 * ------------------------------------------------------------------ */

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

    /* Immutable commercial snapshot — never re-derived from `products`. */
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
      .$type<PaymentStatus>()
      .notNull()
      .default("pending"),
    status: varchar("status", { length: 30 })
      .$type<OrderStatus>()
      .notNull()
      .default("pending"),

    /** Retained for backward compatibility; `payments` is the detailed record. */
    razorpayOrderId: varchar("razorpay_order_id", { length: 60 }),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 60 }),

    courierName: varchar("courier_name", { length: 80 }),
    trackingId: varchar("tracking_id", { length: 80 }),

    /** Inventory idempotency guards — set exactly once each. */
    inventoryReservedAt: timestamp("inventory_reserved_at", {
      withTimezone: true,
    }),
    inventoryReleasedAt: timestamp("inventory_released_at", {
      withTimezone: true,
    }),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

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
    index("orders_payment_status_idx").on(t.paymentStatus),
    index("orders_razorpay_order_idx").on(t.razorpayOrderId),
    index("orders_customer_idx").on(t.customerId),
  ],
);

/**
 * One-time tokens granted only after Twilio Verify approves a COD mobile OTP.
 * We store a SHA-256 hash, never the browser token or the OTP itself. `usedAt`
 * makes a verified phone authorization non-replayable.
 */
export const codPhoneVerifications = pgTable(
  "cod_phone_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 10 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("cod_phone_verifications_token_hash_idx").on(t.tokenHash),
    index("cod_phone_verifications_phone_idx").on(t.phone),
    index("cod_phone_verifications_expires_idx").on(t.expiresAt),
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
    previousStatus: varchar("previous_status", { length: 30 })
      .$type<OrderStatus>(),
    status: varchar("status", { length: 30 }).$type<OrderStatus>().notNull(),
    /** "system" | "customer" | "admin" | "webhook" */
    actor: varchar("actor", { length: 20 }).notNull().default("system"),
    actorAdminId: uuid("actor_admin_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("order_events_order_idx").on(t.orderId),
    index("order_events_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Payments & refunds.
 * ------------------------------------------------------------------ */

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
      .$type<PaymentRecordStatus>()
      .notNull()
      .default("pending"),
    captured: boolean("captured").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    amountRefundedInPaise: integer("amount_refunded_in_paise")
      .notNull()
      .default(0),
    failureReason: varchar("failure_reason", { length: 200 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_provider_payment_idx").on(t.providerPaymentId),
    index("payments_order_idx").on(t.orderId),
    index("payments_provider_order_idx").on(t.providerOrderId),
    index("payments_status_idx").on(t.status),
    index("payments_created_idx").on(t.createdAt),
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
    requestedByAdminId: uuid("requested_by_admin_id"),
    restockRequested: boolean("restock_requested").notNull().default(false),
    restockedAt: timestamp("restocked_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("refunds_provider_refund_idx").on(t.providerRefundId),
    index("refunds_order_idx").on(t.orderId),
    index("refunds_status_idx").on(t.status),
    check("refunds_amount_positive", sql`${t.amountInPaise} > 0`),
  ],
);

/* ------------------------------------------------------------------ *
 * Inventory.
 * ------------------------------------------------------------------ */

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
    /** Negative = stock consumed, positive = stock added. */
    quantityChange: integer("quantity_change").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    reason: varchar("reason", { length: 30 })
      .$type<InventoryReason>()
      .notNull(),
    actorAdminId: uuid("actor_admin_id"),
    note: varchar("note", { length: 300 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inventory_events_product_idx").on(t.productId),
    index("inventory_events_order_idx").on(t.orderId),
    index("inventory_events_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Webhooks — (provider, event_id) unique is the idempotency backbone.
 * ------------------------------------------------------------------ */

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 20 }).notNull(),
    eventId: varchar("event_id", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("webhook_events_provider_event_idx").on(
      t.provider,
      t.eventId,
    ),
    index("webhook_events_type_idx").on(t.eventType),
    index("webhook_events_created_idx").on(t.createdAt),
    index("webhook_events_processed_idx").on(t.processed),
  ],
);

/* ------------------------------------------------------------------ *
 * Email outbox. `event_key` makes transactional sends idempotent.
 * ------------------------------------------------------------------ */

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    /**
     * Deterministic idempotency key, e.g. `<orderId>:shipped:3`.
     * NULL for ad-hoc/manual sends.
     */
    eventKey: varchar("event_key", { length: 160 }),
    template: varchar("template", { length: 40 }).notNull(),
    toEmail: varchar("to_email", { length: 160 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    /**
     * Rendered HTML is intentionally NOT persisted for new sends (PII
     * minimisation) — retries re-render from the order. Kept nullable so
     * historical rows survive untouched.
     */
    html: text("html"),
    delivery: varchar("delivery", { length: 12 })
      .$type<EmailDelivery>()
      .notNull()
      .default("queued"),
    providerMessageId: varchar("provider_message_id", { length: 120 }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_logs_event_key_idx").on(t.eventKey),
    index("email_logs_order_idx").on(t.orderId),
    index("email_logs_to_idx").on(t.toEmail),
    index("email_logs_delivery_idx").on(t.delivery),
    index("email_logs_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Contact messages.
 * ------------------------------------------------------------------ */

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
    /** Legacy boolean retained so existing rows keep their meaning. */
    resolved: boolean("resolved").notNull().default(false),
    status: varchar("status", { length: 12 })
      .$type<ContactStatus>()
      .notNull()
      .default("new"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByAdminId: uuid("resolved_by_admin_id"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_messages_created_idx").on(t.createdAt),
    index("contact_messages_status_idx").on(t.status),
    index("contact_messages_email_idx").on(t.email),
  ],
);

/* ------------------------------------------------------------------ *
 * Admin identity (Supabase Auth user -> Beevo role) and audit trail.
 * ------------------------------------------------------------------ */

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** auth.users.id from the Supabase project. */
    supabaseUserId: uuid("supabase_user_id").notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: varchar("role", { length: 20 }).$type<AdminRole>().notNull(),
    status: varchar("status", { length: 12 })
      .$type<AdminStatus>()
      .notNull()
      .default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_users_supabase_user_idx").on(t.supabaseUserId),
    uniqueIndex("admin_users_email_idx").on(t.email),
    check(
      "admin_users_role_valid",
      sql`${t.role} in ('owner','admin','support','fulfillment')`,
    ),
    check(
      "admin_users_status_valid",
      sql`${t.status} in ('active','suspended')`,
    ),
  ],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    adminEmail: varchar("admin_email", { length: 160 }),
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("admin_audit_logs_admin_idx").on(t.adminUserId),
    index("admin_audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("admin_audit_logs_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Operator-editable, non-secret store settings.
 * ------------------------------------------------------------------ */

export const storeSettings = pgTable("store_settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedByAdminId: uuid("updated_by_admin_id"),
});

/* ------------------------------------------------------------------ */

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
