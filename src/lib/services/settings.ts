import "server-only";

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { policies, site } from "@/lib/config";

/**
 * Operator-editable, NON-SECRET store settings.
 *
 * Secrets (Razorpay keys, webhook secret, Resend key, database URL, Supabase
 * keys) are environment-only and are never readable or writable here.
 */

export const SETTING_KEYS = [
  "store_name",
  "support_email",
  "legal_name",
  "business_address",
  "support_hours",
  "admin_notification_email",
  "dispatch_window",
  "delivery_estimate",
  "replacement_window_days",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export type StoreSettings = Record<SettingKey, string>;

function envDefaults(): StoreSettings {
  return {
    store_name: site.name,
    support_email: site.supportEmail,
    legal_name: site.legalName,
    business_address: site.address,
    support_hours: site.supportHours,
    admin_notification_email:
      process.env.ADMIN_NOTIFICATION_EMAIL ?? site.supportEmail,
    dispatch_window: policies.dispatchWindow,
    delivery_estimate: policies.deliveryEstimate,
    replacement_window_days: String(policies.replacementWindowDays),
  };
}

/** Database values layered over environment/static defaults. */
export async function getStoreSettings(): Promise<StoreSettings> {
  const defaults = envDefaults();
  try {
    const rows = await db
      .select()
      .from(storeSettings)
      .where(inArray(storeSettings.key, [...SETTING_KEYS]));
    for (const row of rows) {
      // A blank stored value means "not configured" for every one of these
      // keys, so fall back to the environment default rather than shipping
      // an empty support address into customer-facing copy.
      if (
        (SETTING_KEYS as readonly string[]).includes(row.key) &&
        row.value.trim() !== ""
      ) {
        defaults[row.key as SettingKey] = row.value;
      }
    }
  } catch {
    // Settings are advisory; a database hiccup must not take the store down.
  }
  return defaults;
}

export async function updateStoreSettings(
  values: Partial<StoreSettings>,
  adminUserId: string,
): Promise<void> {
  const entries = Object.entries(values).filter(([key]) =>
    (SETTING_KEYS as readonly string[]).includes(key),
  ) as Array<[SettingKey, string]>;
  if (entries.length === 0) return;

  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(storeSettings)
        .values({
          key,
          value,
          updatedAt: new Date(),
          updatedByAdminId: adminUserId,
        })
        .onConflictDoUpdate({
          target: storeSettings.key,
          set: { value, updatedAt: new Date(), updatedByAdminId: adminUserId },
        });
    }
  });
}

/** Notification recipient for internal alerts (contact form, low stock). */
export async function notificationEmail(): Promise<string> {
  const settings = await getStoreSettings();
  return settings.admin_notification_email.trim();
}
