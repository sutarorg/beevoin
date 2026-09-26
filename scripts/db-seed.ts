import "./load-env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { inventoryEvents, products, storeSettings } from "../src/db/schema";
import { productDefaults } from "../src/lib/config";

/**
 * Production-safe seed — `npm run db:seed`.
 *
 * Creates ONLY the baseline rows the application needs to function:
 *
 *   • the single Beevo Go product row (inventory 0 — real stock is added by
 *     the operator from /admin/inventory, never invented here);
 *   • default non-secret store settings.
 *
 * It creates NO orders, NO customers, NO payments and NO admin account.
 * Running it twice is safe: existing rows are left untouched, so it can never
 * overwrite a price the operator has edited in the admin.
 *
 * Admin accounts are created in Supabase Auth and linked from
 * /admin/admins — deliberately never hardcoded.
 */
async function main() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Set DATABASE_URL before running the seed.");
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  // ---- Product -----------------------------------------------------------
  const existing = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.slug, productDefaults.slug))
    .limit(1);

  if (existing.length > 0) {
    process.stdout.write(
      `Product "${productDefaults.slug}" already exists — left unchanged.\n`,
    );
  } else {
    const [created] = await db
      .insert(products)
      .values({
        slug: productDefaults.slug,
        sku: productDefaults.sku,
        name: productDefaults.name,
        shortName: productDefaults.shortName,
        description: productDefaults.description,
        shortDescription: productDefaults.shortDescription,
        priceInPaise: productDefaults.priceInPaise,
        codPriceInPaise: productDefaults.codPriceInPaise,
        currency: productDefaults.currency,
        shippingInPaise: productDefaults.shippingInPaise,
        maxPerOrder: productDefaults.maxPerOrder,
        inventoryQuantity: productDefaults.inventoryQuantity,
        lowStockThreshold: productDefaults.lowStockThreshold,
        active: true,
        images: [...productDefaults.images],
        specifications: [...productDefaults.specifications],
      })
      .returning({ id: products.id });

    await db.insert(inventoryEvents).values({
      productId: created.id,
      quantityChange: 0,
      quantityAfter: 0,
      reason: "initial_stock",
      note: "Product created by db:seed. Add real stock from /admin/inventory.",
    });

    process.stdout.write(
      `Created product "${productDefaults.slug}" at ₹${(
        productDefaults.priceInPaise / 100
      ).toFixed(2)} online / ₹${(
        productDefaults.codPriceInPaise / 100
      ).toFixed(2)} COD with 0 units in stock.\n`,
    );
  }

  // ---- Store settings ----------------------------------------------------
  const defaults: Array<[string, string]> = [
    ["store_name", "Beevo"],
    ["support_email", process.env.STORE_CONTACT_EMAIL ?? "support@beevo.in"],
    ["legal_name", process.env.STORE_LEGAL_NAME ?? "Beevo Retail"],
    ["business_address", process.env.STORE_ADDRESS ?? ""],
    ["support_hours", "Mon–Sat, 10:00–18:00 IST"],
    [
      "admin_notification_email",
      process.env.ADMIN_NOTIFICATION_EMAIL ??
        process.env.STORE_CONTACT_EMAIL ??
        "",
    ],
    ["dispatch_window", "24–48 hours on business days"],
    ["delivery_estimate", "3–7 business days depending on your pincode"],
    ["replacement_window_days", "7"],
  ];

  for (const [key, value] of defaults) {
    await db
      .insert(storeSettings)
      .values({ key, value })
      .onConflictDoNothing({ target: storeSettings.key });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(storeSettings);
  process.stdout.write(`Store settings present: ${count} keys.\n`);

  process.stdout.write(
    "\nSeed complete. Next: add stock at /admin/inventory and link your first admin user.\n",
  );

  await pool.end();
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Seed failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
