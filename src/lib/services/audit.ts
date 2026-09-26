import "server-only";

import { desc, eq } from "drizzle-orm";
import { db, type Db } from "@/db";
import { adminAuditLogs, type AdminAuditLog } from "@/db/schema";
import type { AdminActor } from "@/lib/auth/admin";
import { logEvent } from "@/lib/http";

/**
 * Admin audit trail.
 *
 * Every sensitive action records WHO did WHAT to WHICH entity. Metadata is
 * deliberately limited to non-secret, low-PII values — never passwords, API
 * keys, card data, full addresses or raw customer contact details.
 */

export const AUDIT_ACTIONS = [
  "admin_login",
  "admin_user_created",
  "admin_user_updated",
  "admin_user_suspended",
  "admin_user_reactivated",
  "product_updated",
  "price_updated",
  "inventory_adjusted",
  "order_status_changed",
  "order_fulfillment_updated",
  "order_cancelled",
  "refund_created",
  "customer_email_sent",
  "contact_message_resolved",
  "settings_updated",
  "email_retried",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const FORBIDDEN_METADATA_KEYS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "key_secret",
  "authorization",
  "cookie",
  "address",
  "addressline1",
  "addressline2",
];

/** Strips anything that looks like a credential or unnecessary PII. */
function sanitize(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalized = key.toLowerCase().replace(/[^a-z_]/g, "");
    if (FORBIDDEN_METADATA_KEYS.some((bad) => normalized.includes(bad))) continue;
    if (value === undefined) continue;
    clean[key] =
      typeof value === "string" && value.length > 300
        ? `${value.slice(0, 300)}…`
        : value;
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

export async function recordAudit(
  actor: Pick<AdminActor, "id" | "email"> | null,
  input: {
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
  tx: Db = db,
): Promise<void> {
  try {
    await tx.insert(adminAuditLogs).values({
      adminUserId: actor?.id ?? null,
      adminEmail: actor?.email ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: sanitize(input.metadata),
    });
  } catch (err) {
    // Auditing must never break the operation it is describing.
    logEvent("audit_write_failed", {
      action: input.action,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function recentAuditForEntity(
  entityType: string,
  entityId: string,
  limit = 25,
): Promise<AdminAuditLog[]> {
  return db
    .select()
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.entityId, entityId))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(limit)
    .then((rows) => rows.filter((row) => row.entityType === entityType));
}
