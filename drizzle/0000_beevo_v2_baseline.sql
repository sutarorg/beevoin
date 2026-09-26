-- Beevo v2 baseline.
--
-- Safe to run against BOTH a brand-new database and an existing Beevo v1
-- database (orders / order_events / email_logs / contact_messages already
-- present). Every statement is idempotent: existing tables are left alone by
-- CREATE TABLE IF NOT EXISTS, and the v1 upgrade block at the bottom adds the
-- new columns, constraints and indexes those legacy tables are missing.
-- No data is deleted or rewritten.

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"admin_email" varchar(160),
	"action" varchar(60) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_user_id" uuid NOT NULL,
	"email" varchar(160) NOT NULL,
	"name" varchar(100) DEFAULT '' NOT NULL,
	"role" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_role_valid" CHECK ("admin_users"."role" in ('owner', 'admin', 'support', 'fulfillment')),
	CONSTRAINT "admin_users_status_valid" CHECK ("admin_users"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(10),
	"topic" varchar(40) DEFAULT 'general' NOT NULL,
	"order_number" varchar(20),
	"message" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"admin_note" varchar(500),
	"resolved_by_admin_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_messages_status_valid" CHECK ("contact_messages"."status" in ('new', 'read', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(10),
	"name" varchar(100) NOT NULL,
	"first_order_at" timestamp with time zone,
	"last_order_at" timestamp with time zone,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent_in_paise" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"template" varchar(40) NOT NULL,
	"to_email" varchar(160) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"html" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery" varchar(12) DEFAULT 'queued' NOT NULL,
	"provider_message_id" varchar(120),
	"idempotency_key" varchar(200),
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_events_change_non_zero" CHECK ("inventory_events"."quantity_change" <> 0),
	CONSTRAINT "inventory_events_reason_valid" CHECK ("inventory_events"."reason" in ('initial_stock', 'order_reserved', 'order_cancelled', 'refund', 'manual_adjustment', 'restock'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"previous_status" varchar(30),
	"status" varchar(30) NOT NULL,
	"actor_type" varchar(20) DEFAULT 'system' NOT NULL,
	"actor_admin_id" uuid,
	"actor_label" varchar(120),
	"note" text,
	"dedupe_key" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(20) NOT NULL,
	"lookup_secret" varchar(64) NOT NULL,
	"customer_id" uuid,
	"product_id" uuid,
	"customer_name" varchar(100) NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(10) NOT NULL,
	"address_line_1" varchar(140) NOT NULL,
	"address_line_2" varchar(140),
	"locality" varchar(100) NOT NULL,
	"city" varchar(80) NOT NULL,
	"state" varchar(60) NOT NULL,
	"pincode" varchar(6) NOT NULL,
	"product_name" varchar(140) NOT NULL,
	"product_sku" varchar(40) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_in_paise" integer NOT NULL,
	"shipping_in_paise" integer DEFAULT 0 NOT NULL,
	"total_in_paise" integer NOT NULL,
	"refunded_in_paise" integer DEFAULT 0 NOT NULL,
	"payment_method" varchar(20) NOT NULL,
	"payment_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"razorpay_order_id" varchar(60),
	"razorpay_payment_id" varchar(60),
	"courier_name" varchar(80),
	"tracking_id" varchar(80),
	"confirmed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"inventory_committed_at" timestamp with time zone,
	"inventory_released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" > 0),
	CONSTRAINT "orders_total_non_negative" CHECK ("orders"."total_in_paise" >= 0),
	CONSTRAINT "orders_refunded_within_total" CHECK ("orders"."refunded_in_paise" >= 0 and "orders"."refunded_in_paise" <= "orders"."total_in_paise"),
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" in ('pending', 'payment_pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')),
	CONSTRAINT "orders_payment_status_valid" CHECK ("orders"."payment_status" in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
	CONSTRAINT "orders_payment_method_valid" CHECK ("orders"."payment_method" in ('cod', 'online'))
);
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
	"error_code" varchar(80),
	"error_description" varchar(300),
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_in_paise" > 0),
	CONSTRAINT "payments_refund_within_amount" CHECK ("payments"."amount_refunded_in_paise" >= 0 and "payments"."amount_refunded_in_paise" <= "payments"."amount_in_paise"),
	CONSTRAINT "payments_status_valid" CHECK ("payments"."status" in ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(140) NOT NULL,
	"short_name" varchar(60) NOT NULL,
	"sku" varchar(40) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"short_description" varchar(320) DEFAULT '' NOT NULL,
	"price_in_paise" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"max_per_order" integer DEFAULT 5 NOT NULL,
	"shipping_in_paise" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"inventory_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("products"."price_in_paise" > 0),
	CONSTRAINT "products_shipping_non_negative" CHECK ("products"."shipping_in_paise" >= 0),
	CONSTRAINT "products_max_per_order_range" CHECK ("products"."max_per_order" >= 1 and "products"."max_per_order" <= 20),
	CONSTRAINT "products_inventory_non_negative" CHECK ("products"."inventory_quantity" >= 0),
	CONSTRAINT "products_low_stock_non_negative" CHECK ("products"."low_stock_threshold" >= 0)
);
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
	"idempotency_key" varchar(160) NOT NULL,
	"error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_in_paise" > 0),
	CONSTRAINT "refunds_status_valid" CHECK ("refunds"."status" in ('pending', 'processed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_admin_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) DEFAULT 'razorpay' NOT NULL,
	"event_id" varchar(160) NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
--> statement-breakpoint
/* ------------------------------------------------------------------
 * Beevo v1 -> v2 upgrade for tables that already exist in production.
 * Every statement is a no-op on a freshly created database.
 * ---------------------------------------------------------------- */
-- Very old databases predate the tracking secret: add it, backfill an
-- unguessable value per row, then make it required. No row is ever deleted.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lookup_secret" varchar(64);--> statement-breakpoint
UPDATE "orders" SET "lookup_secret" = substr(md5(random()::text || clock_timestamp()::text || "id"::text), 1, 32) || substr(md5(random()::text || "order_number"), 1, 16) WHERE "lookup_secret" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "lookup_secret" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "product_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refunded_in_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_committed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" TYPE varchar(24);--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "previous_status" varchar(30);--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor_type" varchar(20) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor_admin_id" uuid;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "actor_label" varchar(120);--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar(160);--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "provider_message_id" varchar(120);--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(200);--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "html" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "admin_note" varchar(500);--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "resolved_by_admin_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;--> statement-breakpoint
UPDATE "contact_messages" SET "status" = 'resolved' WHERE "resolved" = true AND "status" = 'new';--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_total_non_negative" CHECK ("orders"."total_in_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_within_total" CHECK ("orders"."refunded_in_paise" >= 0 and "orders"."refunded_in_paise" <= "orders"."total_in_paise");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_status_valid" CHECK ("orders"."status" in ('pending', 'payment_pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_status_valid" CHECK ("orders"."payment_status" in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_valid" CHECK ("orders"."payment_method" in ('cod', 'online'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_status_valid" CHECK ("contact_messages"."status" in ('new', 'read', 'resolved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_resolved_by_admin_id_admin_users_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_admin_id_admin_users_id_fk" FOREIGN KEY ("requested_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_admin_id_admin_users_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_idx" ON "admin_audit_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_entity_idx" ON "admin_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_supabase_user_idx" ON "admin_users" USING btree ("supabase_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_idx" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_email_idx" ON "contact_messages" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_last_order_idx" ON "customers" USING btree ("last_order_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_order_idx" ON "email_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs" USING btree ("to_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_created_idx" ON "email_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_delivery_idx" ON "email_logs" USING btree ("delivery");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_idempotency_idx" ON "email_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_events_order_reason_idx" ON "inventory_events" USING btree ("order_id","reason") WHERE order_id is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_events_product_idx" ON "inventory_events" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_events_created_idx" ON "inventory_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_events_dedupe_idx" ON "order_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_items_order_sku_idx" ON "order_items" USING btree ("order_id","sku_snapshot");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_razorpay_payment_idx" ON "orders" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_phone_idx" ON "orders" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_email_idx" ON "orders" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_razorpay_order_idx" ON "orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_idx" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_open_attempt_idx" ON "payments" USING btree ("provider","provider_order_id") WHERE provider_payment_id is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_provider_order_idx" ON "payments" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_created_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_active_idx" ON "products" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_provider_refund_idx" ON "refunds" USING btree ("provider","provider_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_idempotency_idx" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_created_idx" ON "refunds" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_idx" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_created_idx" ON "webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_type_idx" ON "webhook_events" USING btree ("event_type");

--> statement-breakpoint
/* ------------------------------------------------------------------
 * Data migration for existing Beevo v1 orders. Historical snapshots are
 * copied, never rewritten: order_items mirror what the order already says,
 * customers are derived from past orders, and legacy Razorpay references
 * become payment records so the new admin pages can display them.
 * ---------------------------------------------------------------- */
INSERT INTO "order_items" ("order_id", "product_name_snapshot", "sku_snapshot", "unit_price_in_paise", "quantity", "total_in_paise", "created_at")
SELECT "id", "product_name", "product_sku", "unit_price_in_paise", "quantity", ("unit_price_in_paise" * "quantity"), "created_at"
FROM "orders"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "customers" ("email", "phone", "name", "first_order_at", "last_order_at", "total_orders", "total_spent_in_paise")
SELECT lower("email"),
       (array_agg("phone" ORDER BY "created_at" DESC))[1],
       (array_agg("customer_name" ORDER BY "created_at" DESC))[1],
       min("created_at"),
       max("created_at"),
       count(*)::int,
       coalesce(sum("total_in_paise") FILTER (WHERE "status" <> 'cancelled'), 0)::bigint
FROM "orders"
GROUP BY lower("email")
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "orders" o SET "customer_id" = c."id"
FROM "customers" c
WHERE o."customer_id" IS NULL AND lower(o."email") = c."email";--> statement-breakpoint
UPDATE "orders"
SET "confirmed_at" = "created_at"
WHERE "confirmed_at" IS NULL
  AND "status" IN ('confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'refunded');--> statement-breakpoint
UPDATE "orders" SET "delivered_at" = "updated_at" WHERE "delivered_at" IS NULL AND "status" = 'delivered';--> statement-breakpoint
UPDATE "orders" SET "cancelled_at" = "updated_at" WHERE "cancelled_at" IS NULL AND "status" = 'cancelled';--> statement-breakpoint
INSERT INTO "payments" ("order_id", "provider", "provider_order_id", "provider_payment_id", "amount_in_paise", "currency", "status", "captured", "verified", "created_at", "updated_at")
SELECT "id", 'razorpay', "razorpay_order_id", "razorpay_payment_id", "total_in_paise", 'INR',
       CASE "payment_status"
         WHEN 'paid' THEN 'captured'
         WHEN 'refunded' THEN 'refunded'
         WHEN 'failed' THEN 'failed'
         ELSE 'pending'
       END,
       "payment_status" = 'paid',
       "payment_status" IN ('paid', 'refunded'),
       "created_at", "updated_at"
FROM "orders"
WHERE "payment_method" = 'online' AND "razorpay_payment_id" IS NOT NULL
ON CONFLICT DO NOTHING;
