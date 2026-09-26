import "server-only";

import { eq, sql } from "drizzle-orm";
import { type Db } from "@/db";
import { customers, type Customer } from "@/db/schema";

/**
 * Customer directory.
 *
 * Beevo shoppers remain guests — there is no customer login (Supabase Auth is
 * admin-only). This table exists so support can find a person's history.
 *
 * Orders keep their own immutable customer snapshot; editing a customer row
 * never rewrites historical order data.
 */

/** Lowercase + trim. Email is the de-duplication key. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalise an Indian mobile number to the bare 10-digit subscriber number:
 * strips spaces/dashes/brackets and a leading +91, 91 or 0.
 */
export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

/**
 * Find-or-create the customer for an order and roll their aggregates forward.
 * Runs inside the caller's transaction so the customer row and the order row
 * commit together.
 */
export async function upsertCustomerForOrder(
  tx: Db,
  input: {
    name: string;
    email: string;
    phone: string;
    orderTotalInPaise: number;
    placedAt: Date;
  },
): Promise<Customer> {
  const email = normalizeEmail(input.email);
  const phone = normalizeIndianPhone(input.phone);

  const [row] = await tx
    .insert(customers)
    .values({
      email,
      phone,
      name: input.name,
      firstOrderAt: input.placedAt,
      lastOrderAt: input.placedAt,
      totalOrders: 1,
      totalSpentInPaise: input.orderTotalInPaise,
    })
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        name: input.name,
        phone,
        lastOrderAt: input.placedAt,
        totalOrders: sql`${customers.totalOrders} + 1`,
        totalSpentInPaise: sql`${customers.totalSpentInPaise} + ${input.orderTotalInPaise}`,
        firstOrderAt: sql`least(coalesce(${customers.firstOrderAt}, ${input.placedAt.toISOString()}::timestamptz), ${input.placedAt.toISOString()}::timestamptz)`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

/** Reduce lifetime spend after a refund; never goes below zero. */
export async function applyRefundToCustomer(
  tx: Db,
  customerId: string | null,
  amountInPaise: number,
): Promise<void> {
  if (!customerId || amountInPaise <= 0) return;
  await tx
    .update(customers)
    .set({
      totalSpentInPaise: sql`greatest(0, ${customers.totalSpentInPaise} - ${amountInPaise})`,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}
