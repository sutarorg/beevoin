import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentStatuses = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentMethods = ["cod", "online"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

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

    customerName: varchar("customer_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 10 }).notNull(),

    addressLine1: varchar("address_line_1", { length: 140 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 140 }),
    locality: varchar("locality", { length: 100 }).notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    state: varchar("state", { length: 60 }).notNull(),
    pincode: varchar("pincode", { length: 6 }).notNull(),

    productName: varchar("product_name", { length: 140 }).notNull(),
    productSku: varchar("product_sku", { length: 40 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceInPaise: integer("unit_price_in_paise").notNull(),
    shippingInPaise: integer("shipping_in_paise").notNull().default(0),
    totalInPaise: integer("total_in_paise").notNull(),

    paymentMethod: varchar("payment_method", { length: 20 })
      .$type<PaymentMethod>()
      .notNull(),
    paymentStatus: varchar("payment_status", { length: 20 })
      .$type<PaymentStatus>()
      .notNull()
      .default("pending"),
    status: varchar("status", { length: 30 })
      .$type<OrderStatus>()
      .notNull()
      .default("pending"),

    razorpayOrderId: varchar("razorpay_order_id", { length: 60 }),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 60 }),

    courierName: varchar("courier_name", { length: 80 }),
    trackingId: varchar("tracking_id", { length: 80 }),

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
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).$type<OrderStatus>().notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

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
    html: text("html").notNull(),
    /** queued | sent | failed | skipped (skipped = no provider configured) */
    delivery: varchar("delivery", { length: 12 }).notNull().default("queued"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("email_logs_order_idx").on(t.orderId),
    index("email_logs_to_idx").on(t.toEmail),
  ],
);

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
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("contact_messages_created_idx").on(t.createdAt)],
);

export type Order = typeof orders.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
