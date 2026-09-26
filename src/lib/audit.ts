import "server-only";
import { db, type DbClient } from "@/db";
import { adminAuditLogs, type AdminUser } from "@/db/schema";

/**
 * Admin audit trail. Every sensitive action records who did what to which
 * entity. Metadata is deliberately small and never contains secrets or full
 * customer records.
 */

export const AUDIT_ACTIONS = [
  "admin_login",
  "admin_logout",
  "product_updated",
  "price_updated",
  "inventory_adjusted",
  "order_status_changed",
  "order_fulfillment_updated",
  "order_cancelled",
  "refund_created",
  "refund_failed",
  "customer_email_sent",
  "contact_message_updated",
  "admin_user_created",
  "admin_user_updated",
  "admin_user_suspended",
  "admin_user_reactivated",
  "settings_updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditInput = {
  admin: Pick<AdminUser, "id" | "email"> | null;
  action: AuditAction;
  entityType:
    | "order"
    | "product"
    | "payment"
    | "refund"
    | "inventory"
    | "customer"
    | "email"
    | "contact_message"
    | "admin_user"
    | "settings"
    | "session";
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(
  input: AuditInput,
  client: DbClient = db,
): Promise<void> {
  await client.insert(adminAuditLogs).values({
    adminUserId: input.admin?.id ?? null,
    adminEmail: input.admin?.email ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}
