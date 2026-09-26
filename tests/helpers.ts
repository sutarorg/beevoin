import { sql } from "drizzle-orm";
import { db } from "@/db";
import { products, type Product } from "@/db/schema";

/** True when the suite has a real database to talk to. */
export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Wipes every transactional table. Never run against production. */
export async function resetDatabase(): Promise<void> {
  await db.execute(sql`
    truncate table
      admin_audit_logs,
      webhook_events,
      email_logs,
      inventory_events,
      refunds,
      payments,
      order_events,
      order_items,
      orders,
      customers,
      contact_messages,
      products,
      admin_users,
      store_settings
    restart identity cascade
  `);
}

let counter = 0;

export async function createTestProduct(
  overrides: Partial<typeof products.$inferInsert> = {},
): Promise<Product> {
  counter += 1;
  const [product] = await db
    .insert(products)
    .values({
      slug: `beevo-go-test-${counter}`,
      sku: `BG-TEST-${counter}`,
      name: "Beevo Go Mini Thermal Printer",
      shortName: "Beevo Go",
      priceInPaise: 149900,
      shippingInPaise: 0,
      maxPerOrder: 5,
      inventoryQuantity: 10,
      lowStockThreshold: 2,
      active: true,
      ...overrides,
    })
    .returning();
  return product;
}

export const testCustomer = {
  name: "Aarav Sharma",
  email: "aarav@example.com",
  phone: "9876543210",
  addressLine1: "12 MG Road",
  locality: "Shivajinagar",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411005",
};

/** Unique contact details so the 90-second double-submit guard doesn't fire. */
export function uniqueCustomer(seed: number) {
  return {
    ...testCustomer,
    email: `buyer${seed}@example.com`,
    phone: `98765${String(10000 + seed).slice(-5)}`,
  };
}
