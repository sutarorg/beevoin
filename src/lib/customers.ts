import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import { customers, orders, type Customer } from "@/db/schema";

/**
 * Customer directory.
 *
 * Beevo shoppers stay guests — there are no customer logins (Supabase Auth is
 * for admins only). This table is an operational directory built from orders
 * so support can find someone by name, email or phone. Orders keep their own
 * immutable customer snapshot; editing this row never rewrites history.
 */

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Indian mobile normalisation: strip +91/0/spaces, keep the 10 digits. */
export function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null;
}

/** Creates or updates the directory entry for an order's customer. */
export async function upsertCustomerForOrder(
  client: DbClient,
  input: { email: string; phone: string; name: string },
): Promise<Customer> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);

  const [row] = await client
    .insert(customers)
    .values({ email, phone, name: input.name })
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        name: input.name,
        phone: phone ?? sql`${customers.phone}`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/**
 * Recomputes a customer's lifetime aggregates from the orders table, so the
 * numbers can never drift from reality (idempotent by construction).
 */
export async function refreshCustomerAggregates(
  client: DbClient,
  customerId: string,
): Promise<void> {
  await client.execute(sql`
    update customers c
    set total_orders = agg.total_orders,
        total_spent_in_paise = agg.total_spent,
        first_order_at = agg.first_order_at,
        last_order_at = agg.last_order_at,
        updated_at = now()
    from (
      select count(*)::int as total_orders,
             coalesce(sum(case
               when o.status in ('cancelled') then 0
               else o.total_in_paise - o.refunded_in_paise
             end), 0)::bigint as total_spent,
             min(o.created_at) as first_order_at,
             max(o.created_at) as last_order_at
      from orders o
      where o.customer_id = ${customerId}
    ) as agg
    where c.id = ${customerId}
  `);
}

export async function findCustomerById(
  id: string,
): Promise<Customer | undefined> {
  const [row] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return row;
}

export type CustomerSearch = {
  query?: string;
  page?: number;
  pageSize?: number;
};

/** Server-side, paginated, parameterised customer search. */
export async function searchCustomers({
  query,
  page = 1,
  pageSize = 25,
}: CustomerSearch) {
  const term = query?.trim();
  const pattern = term ? `%${term.toLowerCase()}%` : null;
  const where = pattern
    ? or(
        sql`lower(${customers.name}) like ${pattern}`,
        sql`lower(${customers.email}) like ${pattern}`,
        sql`${customers.phone} like ${pattern}`,
      )
    : undefined;

  const offset = (Math.max(page, 1) - 1) * pageSize;

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(sql`${customers.lastOrderAt} desc nulls last`)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return { rows, total: totals, page, pageSize };
}

/** Links legacy/guest orders that share an email to the directory entry. */
export async function attachOrphanOrders(
  client: DbClient,
  customerId: string,
  email: string,
): Promise<void> {
  await client
    .update(orders)
    .set({ customerId })
    .where(and(isNull(orders.customerId), eq(orders.email, normaliseEmail(email))));
}
