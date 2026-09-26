import "./load-env";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import {
  contactMessages,
  customers,
  inventoryEvents,
  orderEvents,
  orderItems,
  orders,
  payments,
  products,
} from "../src/db/schema";

/**
 * DEVELOPMENT-ONLY sample data — `npm run seed:dev`.
 *
 * This is NOT run by `db:seed` and NOT part of any deploy step. It exists so
 * you can click through the admin locally without hand-typing orders.
 *
 * Guard rails:
 *   • refuses to run when NODE_ENV=production;
 *   • refuses to run against a non-local DATABASE_URL unless you pass
 *     --i-know-what-im-doing;
 *   • every row it creates is clearly marked with the DEV- order prefix and a
 *     @example.test email so it can never be mistaken for a real order.
 *
 * Never run this against your production database.
 */

const FORCE = process.argv.includes("--i-know-what-im-doing");

function isLocal(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
}

function orderNumber(seq: number): string {
  return `DEV-${String(seq).padStart(6, "0")}`;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:dev refuses to run with NODE_ENV=production.");
  }

  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL before running seed:dev.");

  if (!isLocal(url) && !FORCE) {
    throw new Error(
      "DATABASE_URL does not look local. Refusing to write sample data.\n" +
        "If you are certain, re-run with: npm run seed:dev -- --i-know-what-im-doing",
    );
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.slug, "beevo-go"))
    .limit(1);

  if (!product) {
    throw new Error("No product found. Run `npm run db:seed` first.");
  }

  // ---- Stock so the storefront is purchasable locally --------------------
  if (product.inventoryQuantity <= 0) {
    const quantityAfter = 50;
    await db
      .update(products)
      .set({ inventoryQuantity: quantityAfter, updatedAt: new Date() })
      .where(eq(products.id, product.id));
    await db.insert(inventoryEvents).values({
      productId: product.id,
      quantityChange: quantityAfter,
      quantityAfter,
      reason: "initial_stock",
      note: "seed:dev sample stock",
    });
    process.stdout.write(`Stocked ${quantityAfter} units for local testing.\n`);
  }

  // ---- Sample orders -----------------------------------------------------
  const samples = [
    {
      seq: 1,
      name: "Dev Tester One",
      email: "dev.one@example.test",
      phone: "9000000001",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      quantity: 1,
      method: "cod" as const,
      status: "confirmed" as const,
      paymentStatus: "pending" as const,
    },
    {
      seq: 2,
      name: "Dev Tester Two",
      email: "dev.two@example.test",
      phone: "9000000002",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      quantity: 2,
      method: "online" as const,
      status: "shipped" as const,
      paymentStatus: "paid" as const,
    },
    {
      seq: 3,
      name: "Dev Tester Three",
      email: "dev.three@example.test",
      phone: "9000000003",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      quantity: 1,
      method: "online" as const,
      status: "delivered" as const,
      paymentStatus: "paid" as const,
    },
  ];

  let created = 0;

  for (const sample of samples) {
    const number = orderNumber(sample.seq);
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, number))
      .limit(1);
    if (existing.length > 0) continue;

    const [customer] = await db
      .insert(customers)
      .values({
        email: sample.email,
        phone: sample.phone,
        name: sample.name,
        totalOrders: 1,
        totalSpentInPaise:
          product.priceInPaise * sample.quantity + product.shippingInPaise,
        lastOrderAt: new Date(),
      })
      .onConflictDoUpdate({
        target: customers.email,
        set: { name: sample.name, lastOrderAt: new Date() },
      })
      .returning({ id: customers.id });

    const total =
      product.priceInPaise * sample.quantity + product.shippingInPaise;

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: number,
        lookupSecret: randomBytes(24).toString("hex"),
        customerId: customer.id,
        productId: product.id,
        customerName: sample.name,
        email: sample.email,
        phone: sample.phone,
        addressLine1: "12, Sample Street",
        locality: "Test Layout",
        city: sample.city,
        state: sample.state,
        pincode: sample.pincode,
        productName: product.name,
        productSku: product.sku,
        quantity: sample.quantity,
        unitPriceInPaise: product.priceInPaise,
        shippingInPaise: product.shippingInPaise,
        totalInPaise: total,
        paymentMethod: sample.method,
        paymentStatus: sample.paymentStatus,
        status: sample.status,
        razorpayOrderId:
          sample.method === "online" ? `order_DEV${sample.seq}` : null,
        razorpayPaymentId:
          sample.method === "online" ? `pay_DEV${sample.seq}` : null,
        inventoryReservedAt: new Date(),
        confirmedAt: new Date(),
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      unitPriceInPaise: product.priceInPaise,
      quantity: sample.quantity,
      totalInPaise: product.priceInPaise * sample.quantity,
    });

    await db.insert(orderEvents).values({
      orderId: order.id,
      previousStatus: null,
      status: sample.status,
      actor: "system",
      note: "Created by seed:dev",
    });

    if (sample.method === "online") {
      await db.insert(payments).values({
        orderId: order.id,
        provider: "razorpay",
        providerOrderId: `order_DEV${sample.seq}`,
        providerPaymentId: `pay_DEV${sample.seq}`,
        amountInPaise: total,
        currency: "INR",
        method: "upi",
        status: "captured",
        captured: true,
        verified: true,
        capturedAt: new Date(),
        verifiedAt: new Date(),
      });
    }

    created += 1;
  }

  await db
    .insert(contactMessages)
    .values({
      name: "Dev Tester One",
      email: "dev.one@example.test",
      phone: "9000000001",
      topic: "shipping",
      orderNumber: orderNumber(1),
      message:
        "Sample contact message created by seed:dev so /admin/messages is not empty locally.",
      status: "new",
    })
    .onConflictDoNothing();

  process.stdout.write(
    `seed:dev complete — ${created} sample order(s) created.\n` +
      "All sample rows use DEV- order numbers and @example.test emails.\n",
  );

  await pool.end();
}

main().catch((error: unknown) => {
  process.stderr.write(
    `seed:dev failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
