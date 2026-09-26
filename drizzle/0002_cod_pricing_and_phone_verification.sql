-- Payment-method pricing and verified COD phone authorization.
--
-- `price_in_paise` is the online-payment price. `cod_price_in_paise` is the
-- Cash on Delivery price. Existing Beevo Go rows are deliberately updated to
-- the requested ₹999 online / ₹1,299 COD prices; historical orders retain
-- their immutable unit-price snapshots.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "cod_price_in_paise" integer;
--> statement-breakpoint
UPDATE "products"
SET
  "price_in_paise" = 99900,
  "cod_price_in_paise" = 129900,
  "updated_at" = now()
WHERE "slug" = 'beevo-go';
--> statement-breakpoint
UPDATE "products"
SET "cod_price_in_paise" = 129900
WHERE "cod_price_in_paise" IS NULL;
--> statement-breakpoint
ALTER TABLE "products"
  ALTER COLUMN "cod_price_in_paise" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "products"
  ALTER COLUMN "cod_price_in_paise" SET DEFAULT 129900;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_cod_price_positive"
    CHECK ("cod_price_in_paise" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cod_phone_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone" varchar(10) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "verified_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cod_phone_verifications_token_hash_idx"
  ON "cod_phone_verifications" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cod_phone_verifications_phone_idx"
  ON "cod_phone_verifications" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cod_phone_verifications_expires_idx"
  ON "cod_phone_verifications" ("expires_at");
