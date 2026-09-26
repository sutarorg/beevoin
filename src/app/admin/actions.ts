"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adminUsers,
  contactMessages,
  orders,
  products,
  type OrderStatus,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  AuthorizationError,
  requireAdmin,
  requirePermission,
} from "@/lib/auth/admin";
import { retryEmail, sendStatusEmail } from "@/lib/email/send";
import { adjustInventory, InsufficientStockError } from "@/lib/inventory";
import { logEvent } from "@/lib/logger";
import {
  InvalidTransitionError,
  transitionOrder,
  updateFulfillment,
} from "@/lib/orders";
import { invalidateProductCache } from "@/lib/product";
import { createOrderRefund } from "@/lib/refunds";
import { writeStoreSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import {
  adminFulfillmentSchema,
  adminRefundSchema,
  adminStatusSchema,
  adminUserSchema,
  adminUserUpdateSchema,
  emailRetrySchema,
  inventoryAdjustSchema,
  messageUpdateSchema,
  productUpdateSchema,
  settingsSchema,
} from "@/lib/validations";
import type { ActionState } from "./action-state";

/**
 * Every admin mutation in one place.
 *
 * Each action re-checks authorisation on the server (never trusting the UI),
 * validates its input with Zod, writes an audit entry and revalidates the
 * affected pages.
 */

function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors };
}

function ok(message: string): ActionState {
  return { ok: true, message };
}

function handleError(err: unknown): ActionState {
  if (err instanceof AuthorizationError) {
    logEvent("admin_action_denied", { code: err.code });
    return fail(err.message);
  }
  if (err instanceof InvalidTransitionError) return fail(err.message);
  if (err instanceof InsufficientStockError) {
    return fail(`Not enough stock (${err.available} available).`);
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return fail(message);
}

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function num(form: FormData, key: string): number {
  return Number(str(form, key));
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

/** Rupees typed by a human → integer paise, without float drift. */
function toPaise(value: string): number {
  const [rupees, paise = ""] = value.replace(/[₹,\s]/g, "").split(".");
  const normalisedPaise = `${paise}00`.slice(0, 2);
  return Number(rupees || "0") * 100 + Number(normalisedPaise || "0");
}

/* -------------------------------------------------------------------------
 * Session
 * ---------------------------------------------------------------------- */

export async function signOutAction(): Promise<void> {
  const admin = await requireAdmin().catch(() => null);
  const supabase = await createClient();
  await supabase.auth.signOut();
  if (admin) {
    await recordAudit({
      admin,
      action: "admin_logout",
      entityType: "session",
      entityId: admin.id,
    });
    logEvent("admin_logout", { role: admin.role });
  }
  redirect("/admin/login");
}

/* -------------------------------------------------------------------------
 * Orders
 * ---------------------------------------------------------------------- */

export async function updateOrderStatusAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const status = str(form, "status") as OrderStatus;
    const admin = await requirePermission(
      status === "cancelled" ? "orders.cancel" : "orders.update_status",
    );

    const parsed = adminStatusSchema.safeParse({
      orderId: str(form, "orderId"),
      status,
      courierName: str(form, "courierName"),
      trackingId: str(form, "trackingId"),
      note: str(form, "note"),
    });
    if (!parsed.success) return fail("Check the fields and try again.");

    const result = await transitionOrder({
      orderId: parsed.data.orderId,
      to: parsed.data.status,
      actor: { type: "admin", admin },
      note: parsed.data.note || null,
      dedupeKey: `${parsed.data.orderId}:${parsed.data.status}:admin`,
      courierName: parsed.data.courierName || null,
      trackingId: parsed.data.trackingId || null,
    });

    if (!result.changed) {
      return ok("That status was already applied — nothing changed.");
    }

    await recordAudit({
      admin,
      action: "order_status_changed",
      entityType: "order",
      entityId: result.order.id,
      metadata: {
        orderNumber: result.order.orderNumber,
        status: result.order.status,
      },
    });

    // One email per transition, keyed so retries can't duplicate it.
    await sendStatusEmail(result.order, {
      idempotencyKey: `${result.order.id}:status:${result.order.status}`,
    });

    revalidatePath(`/admin/orders/${result.order.id}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return ok(`Order moved to “${result.order.status.replace(/_/g, " ")}”.`);
  } catch (err) {
    return handleError(err);
  }
}

export async function updateFulfillmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("orders.update_fulfillment");
    const parsed = adminFulfillmentSchema.safeParse({
      orderId: str(form, "orderId"),
      courierName: str(form, "courierName"),
      trackingId: str(form, "trackingId"),
    });
    if (!parsed.success) return fail("Check the courier details.");

    const updated = await updateFulfillment({
      orderId: parsed.data.orderId,
      courierName: parsed.data.courierName,
      trackingId: parsed.data.trackingId,
      admin,
    });
    if (!updated) return fail("Order not found.");

    await recordAudit({
      admin,
      action: "order_fulfillment_updated",
      entityType: "order",
      entityId: updated.id,
      metadata: {
        orderNumber: updated.orderNumber,
        courier: updated.courierName,
        tracking: Boolean(updated.trackingId),
      },
    });

    revalidatePath(`/admin/orders/${updated.id}`);
    return ok("Courier details saved.");
  } catch (err) {
    return handleError(err);
  }
}

/* -------------------------------------------------------------------------
 * Refunds
 * ---------------------------------------------------------------------- */

export async function createRefundAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("refunds.create");
    const parsed = adminRefundSchema.safeParse({
      orderId: str(form, "orderId"),
      amountInPaise: toPaise(str(form, "amount")),
      reason: str(form, "reason"),
      restock: bool(form, "restock"),
      idempotencyKey: str(form, "idempotencyKey"),
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the refund details.");
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, parsed.data.orderId))
      .limit(1);
    if (!order) return fail("Order not found.");

    const result = await createOrderRefund({
      order,
      amountInPaise: parsed.data.amountInPaise,
      reason: parsed.data.reason,
      admin,
      idempotencyKey: parsed.data.idempotencyKey,
      restock: parsed.data.restock,
    });

    if (!result.ok) return fail(result.error);

    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath("/admin/refunds");
    revalidatePath("/admin/payments");
    return ok(
      result.duplicate
        ? "That refund was already submitted — no second refund was created."
        : "Refund submitted to Razorpay.",
    );
  } catch (err) {
    return handleError(err);
  }
}

/* -------------------------------------------------------------------------
 * Product & inventory
 * ---------------------------------------------------------------------- */

export async function updateProductAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("product.update");
    const parsed = productUpdateSchema.safeParse({
      productId: str(form, "productId"),
      name: str(form, "name"),
      shortName: str(form, "shortName"),
      sku: str(form, "sku"),
      shortDescription: str(form, "shortDescription"),
      description: str(form, "description"),
      priceInPaise: toPaise(str(form, "price")),
      shippingInPaise: toPaise(str(form, "shipping")),
      maxPerOrder: num(form, "maxPerOrder"),
      lowStockThreshold: num(form, "lowStockThreshold"),
      active: bool(form, "active"),
      seoTitle: str(form, "seoTitle"),
      seoDescription: str(form, "seoDescription"),
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the product fields.");
    }

    const [current] = await db
      .select()
      .from(products)
      .where(eq(products.id, parsed.data.productId))
      .limit(1);
    if (!current) return fail("Product not found.");

    const priceChanged = current.priceInPaise !== parsed.data.priceInPaise;
    const shippingChanged =
      current.shippingInPaise !== parsed.data.shippingInPaise;

    // Money changes need the stronger permission.
    if ((priceChanged || shippingChanged) && admin.role === "support") {
      return fail("Your role cannot change pricing.");
    }
    if (priceChanged || shippingChanged) {
      await requirePermission("product.update_price");
    }

    const [updated] = await db
      .update(products)
      .set({
        name: parsed.data.name,
        shortName: parsed.data.shortName,
        sku: parsed.data.sku,
        shortDescription: parsed.data.shortDescription ?? "",
        description: parsed.data.description ?? "",
        priceInPaise: parsed.data.priceInPaise,
        shippingInPaise: parsed.data.shippingInPaise,
        maxPerOrder: parsed.data.maxPerOrder,
        lowStockThreshold: parsed.data.lowStockThreshold,
        active: parsed.data.active,
        metadata: {
          ...(current.metadata ?? {}),
          seoTitle: parsed.data.seoTitle ?? "",
          seoDescription: parsed.data.seoDescription ?? "",
        },
        updatedAt: new Date(),
      })
      .where(eq(products.id, current.id))
      .returning();

    await recordAudit({
      admin,
      action: "product_updated",
      entityType: "product",
      entityId: updated.id,
      metadata: { sku: updated.sku, active: updated.active },
    });

    if (priceChanged) {
      await recordAudit({
        admin,
        action: "price_updated",
        entityType: "product",
        entityId: updated.id,
        metadata: {
          fromInPaise: current.priceInPaise,
          toInPaise: updated.priceInPaise,
        },
      });
    }

    invalidateProductCache();
    revalidatePath("/admin/product");
    revalidatePath("/");
    return ok(
      priceChanged
        ? "Product saved. The new price applies to new orders only."
        : "Product saved.",
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function adjustInventoryAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("inventory.adjust");
    const parsed = inventoryAdjustSchema.safeParse({
      productId: str(form, "productId"),
      mode: str(form, "mode"),
      quantity: num(form, "quantity"),
      note: str(form, "note"),
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the adjustment.");
    }

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, parsed.data.productId))
      .limit(1);
    if (!product) return fail("Product not found.");

    let change = parsed.data.quantity;
    let reason: "restock" | "manual_adjustment" = "manual_adjustment";
    if (parsed.data.mode === "restock") {
      if (change <= 0) return fail("Restock quantity must be positive.");
      reason = "restock";
    } else if (parsed.data.mode === "set") {
      change = parsed.data.quantity - product.inventoryQuantity;
      if (change === 0) return ok("Stock is already at that number.");
    } else if (change === 0) {
      return fail("Enter a non-zero adjustment.");
    }

    const result = await adjustInventory({
      productId: product.id,
      quantityChange: change,
      reason,
      note: parsed.data.note,
      admin,
    });

    await recordAudit({
      admin,
      action: "inventory_adjusted",
      entityType: "inventory",
      entityId: product.id,
      metadata: {
        change,
        quantityAfter: result.quantityAfter,
        reason,
        note: parsed.data.note.slice(0, 120),
      },
    });

    invalidateProductCache();
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/product");
    revalidatePath("/");
    return ok(`Stock updated — ${result.quantityAfter} units on hand.`);
  } catch (err) {
    return handleError(err);
  }
}

/* -------------------------------------------------------------------------
 * Messages, emails, settings, admins
 * ---------------------------------------------------------------------- */

export async function updateMessageAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("messages.resolve");
    const parsed = messageUpdateSchema.safeParse({
      messageId: str(form, "messageId"),
      status: str(form, "status"),
      adminNote: str(form, "adminNote"),
    });
    if (!parsed.success) return fail("Check the message update.");

    const [updated] = await db
      .update(contactMessages)
      .set({
        status: parsed.data.status,
        resolved: parsed.data.status === "resolved",
        adminNote: parsed.data.adminNote || null,
        resolvedByAdminId: parsed.data.status === "resolved" ? admin.id : null,
        resolvedAt: parsed.data.status === "resolved" ? new Date() : null,
      })
      .where(eq(contactMessages.id, parsed.data.messageId))
      .returning();
    if (!updated) return fail("Message not found.");

    await recordAudit({
      admin,
      action: "contact_message_updated",
      entityType: "contact_message",
      entityId: updated.id,
      metadata: { status: updated.status },
    });

    revalidatePath("/admin/messages");
    return ok("Message updated.");
  } catch (err) {
    return handleError(err);
  }
}

export async function retryEmailAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("emails.retry");
    const parsed = emailRetrySchema.safeParse({
      emailLogId: str(form, "emailLogId"),
    });
    if (!parsed.success) return fail("Invalid email reference.");

    const result = await retryEmail(parsed.data.emailLogId);

    await recordAudit({
      admin,
      action: "customer_email_sent",
      entityType: "email",
      entityId: parsed.data.emailLogId,
      metadata: { retry: true, ok: result.ok },
    });

    revalidatePath("/admin/emails");
    return result.ok ? ok("Email re-sent.") : fail(result.error ?? "Send failed.");
  } catch (err) {
    return handleError(err);
  }
}

export async function updateSettingsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("settings.update");
    const parsed = settingsSchema.safeParse({
      storeName: str(form, "storeName"),
      supportEmail: str(form, "supportEmail"),
      legalName: str(form, "legalName"),
      businessAddress: str(form, "businessAddress"),
      supportHours: str(form, "supportHours"),
      adminNotificationEmail: str(form, "adminNotificationEmail"),
      dispatchWindow: str(form, "dispatchWindow"),
      deliveryEstimate: str(form, "deliveryEstimate"),
      replacementWindowDays: num(form, "replacementWindowDays"),
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the settings.");
    }

    await writeStoreSettings(parsed.data, admin.id);
    await recordAudit({
      admin,
      action: "settings_updated",
      entityType: "settings",
      metadata: { keys: Object.keys(parsed.data).length },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/");
    return ok("Settings saved.");
  } catch (err) {
    return handleError(err);
  }
}

export async function createAdminUserAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("admins.manage");
    const parsed = adminUserSchema.safeParse({
      supabaseUserId: str(form, "supabaseUserId"),
      email: str(form, "email"),
      name: str(form, "name"),
      role: str(form, "role"),
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Check the admin details.");
    }

    const [created] = await db
      .insert(adminUsers)
      .values({
        supabaseUserId: parsed.data.supabaseUserId,
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name ?? "",
        role: parsed.data.role,
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      return fail("That Supabase user or email is already an admin.");
    }

    await recordAudit({
      admin,
      action: "admin_user_created",
      entityType: "admin_user",
      entityId: created.id,
      metadata: { role: created.role, email: created.email },
    });

    revalidatePath("/admin/admins");
    return ok(`${created.email} can now sign in as ${created.role}.`);
  } catch (err) {
    return handleError(err);
  }
}

export async function updateAdminUserAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await requirePermission("admins.manage");
    const parsed = adminUserUpdateSchema.safeParse({
      adminUserId: str(form, "adminUserId"),
      role: str(form, "role"),
      status: str(form, "status"),
    });
    if (!parsed.success) return fail("Check the admin update.");

    if (parsed.data.adminUserId === admin.id) {
      return fail("You cannot change your own role or status.");
    }

    const [target] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, parsed.data.adminUserId))
      .limit(1);
    if (!target) return fail("Admin not found.");

    // Never allow the last active owner to be demoted or suspended.
    if (target.role === "owner") {
      const owners = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(and(eq(adminUsers.role, "owner"), eq(adminUsers.status, "active")));
      const losingOwner =
        parsed.data.role !== "owner" || parsed.data.status !== "active";
      if (owners.length <= 1 && losingOwner) {
        return fail("At least one active owner must remain.");
      }
    }

    const [updated] = await db
      .update(adminUsers)
      .set({
        role: parsed.data.role,
        status: parsed.data.status,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, parsed.data.adminUserId))
      .returning();

    await recordAudit({
      admin,
      action:
        updated.status === "suspended"
          ? "admin_user_suspended"
          : target.status === "suspended"
            ? "admin_user_reactivated"
            : "admin_user_updated",
      entityType: "admin_user",
      entityId: updated.id,
      metadata: { role: updated.role, status: updated.status, email: updated.email },
    });

    revalidatePath("/admin/admins");
    return ok(`${updated.email} updated.`);
  } catch (err) {
    return handleError(err);
  }
}
