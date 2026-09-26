"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, contactMessages, products } from "@/db/schema";
import { authorize, AdminAuthError } from "@/lib/auth/admin";
import { recordAudit } from "@/lib/services/audit";
import {
  adjustInventory,
  maybeAlertLowStock,
  OutOfStockError,
} from "@/lib/services/inventory";
import { invalidateProductCache } from "@/lib/services/products";
import { issueRefund, RefundError } from "@/lib/services/refunds";
import { updateStoreSettings } from "@/lib/services/settings";
import { retryEmail } from "@/lib/email/send";
import {
  OrderTransitionError,
  transitionOrderStatus,
  updateFulfillmentDetails,
} from "@/lib/orders";
import {
  adminFulfillmentSchema,
  adminStatusSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  contactResolveSchema,
  emailRetrySchema,
  inventoryAdjustSchema,
  priceUpdateSchema,
  productUpdateSchema,
  refundRequestSchema,
  settingsUpdateSchema,
} from "@/lib/validations";
import { logEvent } from "@/lib/http";

/**
 * Every admin mutation in Beevo lives here.
 *
 * The same three steps happen in each one, in this order, with no exceptions:
 *
 *   1. `authorize(permission)` — re-checks the Supabase session AND the
 *      `admin_users` row AND the role matrix. Hidden UI is never a control.
 *   2. Zod validation of the submitted form data.
 *   3. The service-layer call, then `recordAudit(...)` and a cache revalidate.
 *
 * Actions return a serialisable state object instead of throwing, so the UI
 * can render a precise message. Unexpected errors are logged server-side and
 * reported generically.
 */

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
} | null;

function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors };
}

function done(message: string): ActionState {
  return { ok: true, message };
}

function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Converts a thrown error into a safe, user-facing action state. */
function handle(error: unknown, context: string): ActionState {
  if (error instanceof AdminAuthError) return fail(error.message);
  if (error instanceof OrderTransitionError) return fail(error.message);
  if (error instanceof RefundError) return fail(error.message);
  if (error instanceof OutOfStockError) return fail(error.message);
  logEvent("admin_action_error", {
    context,
    error: error instanceof Error ? error.message : "unknown",
  });
  return fail("Something went wrong. The action was not completed.");
}

const str = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? (form.get(key) as string).trim() : "";
const bool = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";
const num = (form: FormData, key: string) => Number(str(form, key));

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

export async function updateOrderStatusAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("orders.update_status");

    const parsed = adminStatusSchema.safeParse({
      orderId: str(form, "orderId"),
      status: str(form, "status"),
      courierName: str(form, "courierName"),
      trackingId: str(form, "trackingId"),
      note: str(form, "note"),
    });
    if (!parsed.success) {
      return fail("Check the form.", zodErrors(parsed.error.issues));
    }

    // Cancelling is a separate, higher permission than a routine status move.
    if (parsed.data.status === "cancelled") {
      await authorize("orders.cancel");
    }

    const result = await transitionOrderStatus({
      orderId: parsed.data.orderId,
      to: parsed.data.status,
      actor: "admin",
      actorAdminId: actor.id,
      note: parsed.data.note || undefined,
      courierName: parsed.data.courierName || undefined,
      trackingId: parsed.data.trackingId || undefined,
    });

    if (!result.changed) {
      return done("Order was already in that status — nothing changed.");
    }

    await recordAudit(actor, {
      action:
        parsed.data.status === "cancelled"
          ? "order_cancelled"
          : "order_status_changed",
      entityType: "order",
      entityId: parsed.data.orderId,
      metadata: {
        to: parsed.data.status,
        orderNumber: result.order.orderNumber,
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return done(
      `Order moved to "${parsed.data.status.replace(/_/g, " ")}". The customer has been emailed.`,
    );
  } catch (error) {
    return handle(error, "updateOrderStatus");
  }
}

export async function updateFulfillmentAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("orders.update_fulfillment");

    const parsed = adminFulfillmentSchema.safeParse({
      orderId: str(form, "orderId"),
      courierName: str(form, "courierName"),
      trackingId: str(form, "trackingId"),
    });
    if (!parsed.success) {
      return fail("Check the form.", zodErrors(parsed.error.issues));
    }

    await updateFulfillmentDetails({
      orderId: parsed.data.orderId,
      courierName: parsed.data.courierName ?? null,
      trackingId: parsed.data.trackingId ?? null,
      actorAdminId: actor.id,
    });

    await recordAudit(actor, {
      action: "order_fulfillment_updated",
      entityType: "order",
      entityId: parsed.data.orderId,
      metadata: {
        courier: parsed.data.courierName,
        tracking: parsed.data.trackingId,
      },
    });

    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return done("Courier and tracking details saved.");
  } catch (error) {
    return handle(error, "updateFulfillment");
  }
}

/* ------------------------------------------------------------------ *
 * Refunds
 * ------------------------------------------------------------------ */

export async function createRefundAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("refunds.create");

    // The form collects rupees for humans; paise is the only unit stored.
    const rupees = Number(str(form, "amountInRupees"));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      return fail("Enter a refund amount in rupees.", {
        amountInRupees: "Enter a valid amount",
      });
    }
    const amountInPaise = Math.round(rupees * 100);

    const parsed = refundRequestSchema.safeParse({
      orderId: str(form, "orderId"),
      amountInPaise,
      reason: str(form, "reason"),
      restock: bool(form, "restock"),
      confirm: bool(form, "confirm"),
    });
    if (!parsed.success) {
      return fail(
        "The refund was not submitted — check the form.",
        zodErrors(parsed.error.issues),
      );
    }

    const refund = await issueRefund({
      orderId: parsed.data.orderId,
      amountInPaise: parsed.data.amountInPaise,
      reason: parsed.data.reason,
      restock: parsed.data.restock,
      actor,
    });

    revalidatePath("/admin/refunds");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return done(
      `Refund of ₹${(parsed.data.amountInPaise / 100).toFixed(2)} submitted to Razorpay (${refund.providerRefundId ?? refund.id}). The customer has been emailed.`,
    );
  } catch (error) {
    return handle(error, "createRefund");
  }
}

/* ------------------------------------------------------------------ *
 * Product & price
 * ------------------------------------------------------------------ */

function parseKeyValueLines(raw: string, max: number) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx === -1) return null;
      return {
        label: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    })
    .filter((v): v is { label: string; value: string } => v !== null);
}

export async function updateProductAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("product.update");
    const productId = str(form, "productId");

    const specs = parseKeyValueLines(str(form, "specifications"), 20);
    const images = parseKeyValueLines(str(form, "images"), 12).map((row) => ({
      src: row.label,
      alt: row.value,
    }));

    const parsed = productUpdateSchema.safeParse({
      name: str(form, "name"),
      shortName: str(form, "shortName"),
      sku: str(form, "sku"),
      shortDescription: str(form, "shortDescription"),
      description: str(form, "description"),
      active: bool(form, "active"),
      maxPerOrder: num(form, "maxPerOrder"),
      lowStockThreshold: num(form, "lowStockThreshold"),
      metaTitle: str(form, "metaTitle"),
      metaDescription: str(form, "metaDescription"),
      specifications: specs,
      images,
    });
    if (!parsed.success) {
      return fail(
        "Product not saved — check the highlighted fields.",
        zodErrors(parsed.error.issues),
      );
    }

    await db
      .update(products)
      .set({
        name: parsed.data.name,
        shortName: parsed.data.shortName,
        sku: parsed.data.sku,
        shortDescription: parsed.data.shortDescription,
        description: parsed.data.description,
        active: parsed.data.active,
        maxPerOrder: parsed.data.maxPerOrder,
        lowStockThreshold: parsed.data.lowStockThreshold,
        metaTitle: parsed.data.metaTitle || null,
        metaDescription: parsed.data.metaDescription || null,
        specifications: parsed.data.specifications,
        images: parsed.data.images,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    await recordAudit(actor, {
      action: "product_updated",
      entityType: "product",
      entityId: productId,
      metadata: {
        active: parsed.data.active,
        maxPerOrder: parsed.data.maxPerOrder,
        sku: parsed.data.sku,
      },
    });

    // Existing orders keep their own price/name snapshot — editing the
    // product never rewrites history.
    invalidateProductCache();
    revalidatePath("/admin/product");
    revalidatePath("/");
    return done("Product details saved and the storefront cache refreshed.");
  } catch (error) {
    return handle(error, "updateProduct");
  }
}

export async function updatePriceAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    // Price is a separate, owner/admin-only permission.
    const actor = await authorize("product.update_price");
    const productId = str(form, "productId");

    const priceRupees = Number(str(form, "priceInRupees"));
    const codPriceRupees = Number(str(form, "codPriceInRupees"));
    const shippingRupees = Number(str(form, "shippingInRupees"));
    if (
      !Number.isFinite(priceRupees) ||
      !Number.isFinite(codPriceRupees) ||
      !Number.isFinite(shippingRupees)
    ) {
      return fail("Enter online price, COD price and shipping as numbers in rupees.");
    }

    const parsed = priceUpdateSchema.safeParse({
      priceInPaise: Math.round(priceRupees * 100),
      codPriceInPaise: Math.round(codPriceRupees * 100),
      shippingInPaise: Math.round(shippingRupees * 100),
    });
    if (!parsed.success) {
      return fail("Price not saved.", zodErrors(parsed.error.issues));
    }

    const [before] = await db
      .select({
        priceInPaise: products.priceInPaise,
        codPriceInPaise: products.codPriceInPaise,
        shippingInPaise: products.shippingInPaise,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!before) return fail("Product not found.");

    await db
      .update(products)
      .set({
        priceInPaise: parsed.data.priceInPaise,
        codPriceInPaise: parsed.data.codPriceInPaise,
        shippingInPaise: parsed.data.shippingInPaise,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    await recordAudit(actor, {
      action: "price_updated",
      entityType: "product",
      entityId: productId,
      metadata: {
        fromPriceInPaise: before.priceInPaise,
        toPriceInPaise: parsed.data.priceInPaise,
        fromCodPriceInPaise: before.codPriceInPaise,
        toCodPriceInPaise: parsed.data.codPriceInPaise,
        fromShippingInPaise: before.shippingInPaise,
        toShippingInPaise: parsed.data.shippingInPaise,
      },
    });

    invalidateProductCache();
    revalidatePath("/admin/product");
    revalidatePath("/");
    return done(
      `Prices updated to ₹${(parsed.data.priceInPaise / 100).toFixed(2)} online and ₹${(parsed.data.codPriceInPaise / 100).toFixed(2)} for COD. Existing orders are unaffected — their totals are historical snapshots.`,
    );
  } catch (error) {
    return handle(error, "updatePrice");
  }
}

/* ------------------------------------------------------------------ *
 * Inventory
 * ------------------------------------------------------------------ */

export async function adjustInventoryAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("inventory.adjust");
    const productId = str(form, "productId");

    const direction = str(form, "direction") === "remove" ? -1 : 1;
    const units = Number(str(form, "units"));
    if (!Number.isFinite(units) || units <= 0) {
      return fail("Enter how many units to add or remove.", {
        units: "Enter a positive number",
      });
    }

    const parsed = inventoryAdjustSchema.safeParse({
      delta: Math.round(units) * direction,
      reason: str(form, "reason"),
      note: str(form, "note"),
    });
    if (!parsed.success) {
      return fail("Stock not changed.", zodErrors(parsed.error.issues));
    }

    const after = await adjustInventory({
      productId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      note: parsed.data.note,
      actorAdminId: actor.id,
    });

    await recordAudit(actor, {
      action: "inventory_adjusted",
      entityType: "product",
      entityId: productId,
      metadata: {
        delta: parsed.data.delta,
        quantityAfter: after,
        reason: parsed.data.reason,
      },
    });

    invalidateProductCache();
    // If a manual removal took stock under the threshold, alert as usual.
    if (parsed.data.delta < 0) void maybeAlertLowStock(productId);
    revalidatePath("/admin/inventory");
    revalidatePath("/");
    return done(
      `Stock ${parsed.data.delta > 0 ? "increased" : "reduced"} by ${Math.abs(
        parsed.data.delta,
      )}. New quantity: ${after}.`,
    );
  } catch (error) {
    return handle(error, "adjustInventory");
  }
}

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

export async function updateMessageStatusAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("messages.resolve");

    const parsed = contactResolveSchema.safeParse({
      messageId: str(form, "messageId"),
      status: str(form, "status"),
    });
    if (!parsed.success) return fail("Invalid request.");

    const resolved = parsed.data.status === "resolved";
    await db
      .update(contactMessages)
      .set({
        status: parsed.data.status,
        resolved,
        resolvedAt: resolved ? new Date() : null,
        resolvedByAdminId: resolved ? actor.id : null,
      })
      .where(eq(contactMessages.id, parsed.data.messageId));

    await recordAudit(actor, {
      action: "contact_message_resolved",
      entityType: "contact_message",
      entityId: parsed.data.messageId,
      metadata: { status: parsed.data.status },
    });

    revalidatePath("/admin/messages");
    return done(`Message marked "${parsed.data.status}".`);
  } catch (error) {
    return handle(error, "updateMessageStatus");
  }
}

/* ------------------------------------------------------------------ *
 * Emails
 * ------------------------------------------------------------------ */

export async function retryEmailAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("emails.retry");

    const parsed = emailRetrySchema.safeParse({
      emailLogId: str(form, "emailLogId"),
    });
    if (!parsed.success) return fail("Invalid request.");

    const result = await retryEmail(parsed.data.emailLogId);

    await recordAudit(actor, {
      action: "email_retried",
      entityType: "email_log",
      entityId: parsed.data.emailLogId,
      metadata: { ok: result.ok },
    });

    revalidatePath("/admin/emails");
    return result.ok
      ? done("Email re-sent.")
      : fail(result.error ?? "The email could not be re-sent.");
  } catch (error) {
    return handle(error, "retryEmail");
  }
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function updateSettingsAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("settings.update");

    const parsed = settingsUpdateSchema.safeParse({
      store_name: str(form, "store_name"),
      support_email: str(form, "support_email"),
      legal_name: str(form, "legal_name"),
      business_address: str(form, "business_address"),
      support_hours: str(form, "support_hours"),
      admin_notification_email: str(form, "admin_notification_email"),
      dispatch_window: str(form, "dispatch_window"),
      delivery_estimate: str(form, "delivery_estimate"),
      replacement_window_days: str(form, "replacement_window_days"),
    });
    if (!parsed.success) {
      return fail("Settings not saved.", zodErrors(parsed.error.issues));
    }

    await updateStoreSettings(
      {
        ...parsed.data,
        replacement_window_days: String(parsed.data.replacement_window_days),
      },
      actor.id,
    );

    await recordAudit(actor, {
      action: "settings_updated",
      entityType: "store_settings",
      entityId: null,
      metadata: { keys: Object.keys(parsed.data).join(",") },
    });

    revalidatePath("/admin/settings");
    return done("Store settings saved.");
  } catch (error) {
    return handle(error, "updateSettings");
  }
}

/* ------------------------------------------------------------------ *
 * Admin users
 * ------------------------------------------------------------------ */

export async function createAdminUserAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("admins.manage");

    const parsed = adminUserCreateSchema.safeParse({
      supabaseUserId: str(form, "supabaseUserId"),
      email: str(form, "email"),
      name: str(form, "name"),
      role: str(form, "role"),
    });
    if (!parsed.success) {
      return fail(
        "Admin not created — check the form.",
        zodErrors(parsed.error.issues),
      );
    }

    try {
      const [created] = await db
        .insert(adminUsers)
        .values({
          supabaseUserId: parsed.data.supabaseUserId,
          email: parsed.data.email.toLowerCase(),
          name: parsed.data.name,
          role: parsed.data.role,
          status: "active",
        })
        .returning({ id: adminUsers.id });

      await recordAudit(actor, {
        action: "admin_user_created",
        entityType: "admin_user",
        entityId: created.id,
        metadata: { role: parsed.data.role },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/duplicate key|unique/i.test(message)) {
        return fail(
          "That Supabase user (or email) is already linked to an admin account.",
        );
      }
      throw error;
    }

    revalidatePath("/admin/admins");
    return done(`${parsed.data.name} can now sign in as ${parsed.data.role}.`);
  } catch (error) {
    return handle(error, "createAdminUser");
  }
}

export async function updateAdminUserAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const actor = await authorize("admins.manage");

    const parsed = adminUserUpdateSchema.safeParse({
      adminUserId: str(form, "adminUserId"),
      role: str(form, "role"),
      status: str(form, "status"),
    });
    if (!parsed.success) return fail("Invalid request.");

    // An owner must never be able to lock every owner out of the store.
    if (parsed.data.adminUserId === actor.id) {
      if (parsed.data.status !== "active" || parsed.data.role !== actor.role) {
        return fail(
          "You cannot change your own role or suspend your own account. Ask another owner.",
        );
      }
    }

    const [target] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, parsed.data.adminUserId))
      .limit(1);
    if (!target) return fail("Admin user not found.");

    if (target.role === "owner" && parsed.data.role !== "owner") {
      const owners = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(eq(adminUsers.role, "owner"));
      const activeOwners = owners.length;
      if (activeOwners <= 1) {
        return fail("The store must always have at least one owner.");
      }
    }

    await db
      .update(adminUsers)
      .set({
        role: parsed.data.role,
        status: parsed.data.status,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, parsed.data.adminUserId));

    await recordAudit(actor, {
      action:
        parsed.data.status === "suspended"
          ? "admin_user_suspended"
          : target.status === "suspended"
            ? "admin_user_reactivated"
            : "admin_user_updated",
      entityType: "admin_user",
      entityId: parsed.data.adminUserId,
      metadata: { role: parsed.data.role, status: parsed.data.status },
    });

    revalidatePath("/admin/admins");
    return done("Admin user updated.");
  } catch (error) {
    return handle(error, "updateAdminUser");
  }
}
