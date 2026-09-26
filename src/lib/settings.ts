import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { policyDefaults, site } from "./config";

/**
 * Store settings = operator-editable copy and contact points.
 *
 * Defaults come from environment variables / `config.ts`; anything saved in
 * `store_settings` from /admin/settings wins. Commercial values (price,
 * shipping, inventory) live on the product row, never here.
 */

export const SETTINGS_TAG = "beevo-store-settings";

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  legalName: string;
  businessAddress: string;
  supportHours: string;
  adminNotificationEmail: string;
  dispatchWindow: string;
  deliveryEstimate: string;
  replacementWindowDays: number;
};

export const SETTINGS_KEYS = [
  "storeName",
  "supportEmail",
  "legalName",
  "businessAddress",
  "supportHours",
  "adminNotificationEmail",
  "dispatchWindow",
  "deliveryEstimate",
  "replacementWindowDays",
] as const satisfies readonly (keyof StoreSettings)[];

export function settingsDefaults(): StoreSettings {
  return {
    storeName: site.name,
    supportEmail: site.supportEmail,
    legalName: site.legalName,
    businessAddress: site.address,
    supportHours: site.supportHours,
    adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
    dispatchWindow: policyDefaults.dispatchWindow,
    deliveryEstimate: policyDefaults.deliveryEstimate,
    replacementWindowDays: policyDefaults.replacementWindowDays,
  };
}

async function readSettings(): Promise<StoreSettings> {
  const defaults = settingsDefaults();
  try {
    const rows = await db
      .select({ key: storeSettings.key, value: storeSettings.value })
      .from(storeSettings);
    const merged: StoreSettings = { ...defaults };
    for (const row of rows) {
      if (!(SETTINGS_KEYS as readonly string[]).includes(row.key)) continue;
      const key = row.key as keyof StoreSettings;
      if (key === "replacementWindowDays") {
        const value = Number(row.value);
        if (Number.isInteger(value) && value >= 0 && value <= 365) {
          merged.replacementWindowDays = value;
        }
        continue;
      }
      if (typeof row.value === "string" && row.value.trim() !== "") {
        merged[key] = row.value as never;
      }
    }
    return merged;
  } catch {
    // Settings are presentation copy: never take the store down for them.
    return defaults;
  }
}

const cachedSettings = unstable_cache(readSettings, ["beevo-store-settings"], {
  revalidate: 300,
  tags: [SETTINGS_TAG],
});

/** Cached read — safe for every page render. */
export function getStoreSettings(): Promise<StoreSettings> {
  return cachedSettings();
}

/** Uncached read — use inside admin mutations. */
export function getStoreSettingsFresh(): Promise<StoreSettings> {
  return readSettings();
}

export async function writeStoreSettings(
  values: Partial<StoreSettings>,
  adminUserId: string | null,
): Promise<void> {
  const entries = Object.entries(values).filter(([key]) =>
    (SETTINGS_KEYS as readonly string[]).includes(key),
  );
  if (entries.length === 0) return;

  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(storeSettings)
        .values({
          key,
          value: value as never,
          updatedByAdminId: adminUserId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: storeSettings.key,
          set: {
            value: value as never,
            updatedByAdminId: adminUserId,
            updatedAt: new Date(),
          },
        });
    }
  });

  updateTag(SETTINGS_TAG);
}
