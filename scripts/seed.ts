/**
 * Seeds the catalogue row and default store settings.
 *
 * This script creates NO fake orders, customers, payments or reviews — the
 * only rows it writes are the real product Beevo sells and the store's own
 * settings. It is idempotent: running it twice changes nothing the second
 * time, and it never overwrites a price or stock level you have edited in the
 * admin.
 *
 *   npm run db:seed
 *   INITIAL_STOCK=50 npm run db:seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  inventoryEvents,
  products,
  storeSettings,
} from "../src/db/schema";
import { PRODUCT_IMAGES, SPECS } from "../src/lib/content";

const SLUG = "beevo-go";
const SKU = "BG-GO-01";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl:
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  const initialStock = Number(process.env.INITIAL_STOCK ?? 0);

  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.slug, SLUG))
    .limit(1);

  if (existing) {
    console.log(
      `Product already present (${existing.sku}, ₹${existing.priceInPaise / 100}, ${existing.inventoryQuantity} in stock) — leaving it untouched.`,
    );
  } else {
    const [created] = await db
      .insert(products)
      .values({
        slug: SLUG,
        sku: SKU,
        name: "Beevo Go Mini Thermal Printer",
        shortName: "Beevo Go",
        shortDescription:
          "Pocket-size Bluetooth thermal printer — notes, labels, lists and QR codes, completely ink-free.",
        description:
          "A palm-size Bluetooth thermal printer for notes, labels, to-do lists, QR codes and little everyday prints. Charges over USB, fits in your pocket, and prints crisp black-and-white in seconds on 57 mm thermal paper.",
        priceInPaise: 149900,
        currency: "INR",
        maxPerOrder: 5,
        shippingInPaise: 0,
        active: true,
        inventoryQuantity: 0,
        lowStockThreshold: 5,
        images: [...PRODUCT_IMAGES],
        specifications: SPECS,
        metadata: {
          seoTitle: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹1,499",
          seoDescription:
            "Print notes, labels and QR codes from your phone. No ink, ever. Free shipping across India with Cash on Delivery.",
        },
      })
      .returning();
    console.log(`Created product ${created.sku} at ₹${created.priceInPaise / 100}.`);

    if (initialStock > 0) {
      await db
        .update(products)
        .set({ inventoryQuantity: initialStock })
        .where(eq(products.id, created.id));
      await db.insert(inventoryEvents).values({
        productId: created.id,
        quantityChange: initialStock,
        quantityAfter: initialStock,
        reason: "initial_stock",
        note: "Opening stock set by the seed script",
      });
      console.log(`Opening stock set to ${initialStock} units.`);
    } else {
      console.log(
        "Stock left at 0 — add real stock from /admin/inventory (or re-run with INITIAL_STOCK=n).",
      );
    }
  }

  // Store settings: only insert the keys that don't exist yet.
  const defaults: Record<string, unknown> = {
    storeName: "Beevo",
    supportEmail: process.env.STORE_CONTACT_EMAIL ?? "support@beevo.in",
    legalName: process.env.STORE_LEGAL_NAME ?? "Beevo Retail",
    businessAddress: process.env.STORE_ADDRESS ?? "",
    supportHours: "Mon–Sat, 10:00–18:00 IST",
    adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
    dispatchWindow: "24–48 hours on business days",
    deliveryEstimate: "3–7 business days depending on your pincode",
    replacementWindowDays: 7,
  };

  let inserted = 0;
  for (const [key, value] of Object.entries(defaults)) {
    const result = await db
      .insert(storeSettings)
      .values({ key, value })
      .onConflictDoNothing({ target: storeSettings.key })
      .returning();
    if (result.length > 0) inserted += 1;
  }
  console.log(
    inserted > 0
      ? `Wrote ${inserted} default store setting(s).`
      : "Store settings already configured — nothing changed.",
  );

  await pool.end();
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
