-- Beevo baseline schema.
--
-- These four tables already exist on the live production database. Every
-- statement is written with IF NOT EXISTS so this migration is a no-op on an
-- existing deployment and a full bootstrap on a fresh database. Nothing here
-- drops or rewrites data.

CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(20) NOT NULL,
	"lookup_secret" varchar(64) NOT NULL,
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
	"payment_method" varchar(20) NOT NULL,
	"payment_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"razorpay_order_id" varchar(60),
	"razorpay_payment_id" varchar(60),
	"courier_name" varchar(80),
	"tracking_id" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" varchar(30) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"template" varchar(40) NOT NULL,
	"to_email" varchar(160) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"html" text,
	"delivery" varchar(12) DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_order_id_orders_id_fk"
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" ("order_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_razorpay_payment_idx" ON "orders" ("razorpay_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_phone_idx" ON "orders" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_email_idx" ON "orders" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_created_idx" ON "orders" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_order_idx" ON "order_events" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_order_idx" ON "email_logs" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs" ("to_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_created_idx" ON "contact_messages" ("created_at");
