-- Beevo production upgrade.
--
-- Adds: products, customers, order_items, payments, refunds, inventory_events,
-- webhook_events, admin_users, admin_audit_logs, store_settings, and additive
-- columns on the four existing tables.
--
-- SAFETY: no table is dropped, no column is dropped, no row is rewritten.
-- Every statement is idempotent so it can be re-run without harm.

CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(140) NOT NULL,
	"short_name" varchar(60) NOT NULL,
	"sku" varchar(40) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"short_description" varchar(300) DEFAULT '' NOT NULL,
	"price_in_paise" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"max_per_order" integer DEFAULT 5 NOT NULL,
	"shipping_in_paise" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"inventory_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta_title" varchar(160),
	"meta_description" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("price_in_paise" > 0),
	CONSTRAINT "products_shipping_non_negative" CHECK ("shipping_in_paise" >= 0),
	CONSTRAINT "products_inventory_non_negative" CHECK ("inventory_quantity" >= 0),
	CONSTRAINT "products_max_per_order_positive" CHECK ("max_per_order" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_idx" ON "products" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_idx" ON "products" ("sku");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"first_order_at" timestamp with time zone,
	"last_order_at" timestamp with time zone,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent_in_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_idx" ON "customers" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_last_order_idx" ON "customers" ("last_order_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_user_id" uuid NOT NULL,
	"email" varchar(160) NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(20) NOT NULL,
	"status" varchar(12) DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_role_valid" CHECK ("role" in ('owner','admin','support','fulfillment')),
	CONSTRAINT "admin_users_status_valid" CHECK ("status" in ('active','suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_supabase_user_idx" ON "admin_users" ("supabase_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_idx" ON "admin_users" ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"admin_email" varchar(160),
	"action" varchar(60) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" varchar(80),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_admin_users_id_fk"
		FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_idx" ON "admin_audit_logs" ("admin_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_entity_idx" ON "admin_audit_logs" ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_idx" ON "admin_audit_logs" ("created_at");
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "product_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refunded_in_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_reserved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_released_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipped_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" TYPE varchar(24);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk"
		FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk"
		FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders" ("payment_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_razorpay_order_idx" ON "orders" ("razorpay_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_idx" ON "orders" ("customer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name_snapshot" varchar(140) NOT NULL,
	"sku_snapshot" varchar(40) NOT NULL,
	"unit_price_in_paise" integer NOT NULL,
	"quantity" integer NOT NULL,
	"total_in_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk"
		FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id");
--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "previous_status" varchar(30);
--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor" varchar(20) DEFAULT 'system' NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor_admin_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_created_idx" ON "order_events" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(20) DEFAULT 'razorpay' NOT NULL,
	"provider_order_id" varchar(60),
	"provider_payment_id" varchar(60),
	"amount_in_paise" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"method" varchar(30),
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"captured" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"amount_refunded_in_paise" integer DEFAULT 0 NOT NULL,
	"failure_reason" varchar(200),
	"verified_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_idx" ON "payments" ("provider_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_provider_order_idx" ON "payments" ("provider_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_created_idx" ON "payments" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid,
	"provider" varchar(20) DEFAULT 'razorpay' NOT NULL,
	"provider_refund_id" varchar(60),
	"amount_in_paise" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" varchar(300) NOT NULL,
	"requested_by_admin_id" uuid,
	"restock_requested" boolean DEFAULT false NOT NULL,
	"restocked_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("amount_in_paise" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk"
		FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_provider_refund_idx" ON "refunds" ("provider_refund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_order_idx" ON "refunds" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"quantity_change" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"reason" varchar(30) NOT NULL,
	"actor_admin_id" uuid,
	"note" varchar(300),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_product_id_products_id_fk"
		FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_events_product_idx" ON "inventory_events" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_events_order_idx" ON "inventory_events" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_events_created_idx" ON "inventory_events" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"event_id" varchar(120) NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"order_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_idx" ON "webhook_events" ("provider","event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_type_idx" ON "webhook_events" ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_created_idx" ON "webhook_events" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_processed_idx" ON "webhook_events" ("processed");
--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "html" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "event_key" varchar(160);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "provider_message_id" varchar(120);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_event_key_idx" ON "email_logs" ("event_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_delivery_idx" ON "email_logs" ("delivery");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_created_idx" ON "email_logs" ("created_at");
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "status" varchar(12) DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "resolved_by_admin_id" uuid;
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "notified_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "contact_messages" SET "status" = 'resolved' WHERE "resolved" = true AND "status" = 'new';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_email_idx" ON "contact_messages" ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_admin_id" uuid
);
