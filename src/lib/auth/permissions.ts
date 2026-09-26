import type { AdminRole } from "@/db/schema";

/**
 * Role → permission matrix. Pure data: imported by both server authorisation
 * checks and the admin navigation. The server is always the enforcer — the UI
 * only uses this to avoid showing actions that would be rejected anyway.
 */

export const permissions = [
  "dashboard.view",
  "orders.view",
  "orders.update_status",
  "orders.update_fulfillment",
  "orders.cancel",
  "payments.view",
  "refunds.view",
  "refunds.create",
  "customers.view",
  "product.view",
  "product.update",
  "product.update_price",
  "inventory.view",
  "inventory.adjust",
  "messages.view",
  "messages.resolve",
  "emails.view",
  "emails.retry",
  "webhooks.view",
  "settings.view",
  "settings.update",
  "admins.view",
  "admins.manage",
  "audit.view",
] as const;

export type Permission = (typeof permissions)[number];

const OWNER: Permission[] = [...permissions];

const ADMIN: Permission[] = [
  "dashboard.view",
  "orders.view",
  "orders.update_status",
  "orders.update_fulfillment",
  "orders.cancel",
  "payments.view",
  "refunds.view",
  "refunds.create",
  "customers.view",
  "product.view",
  "product.update",
  "product.update_price",
  "inventory.view",
  "inventory.adjust",
  "messages.view",
  "messages.resolve",
  "emails.view",
  "emails.retry",
  "webhooks.view",
  "audit.view",
];

const SUPPORT: Permission[] = [
  "dashboard.view",
  "orders.view",
  "payments.view",
  "refunds.view",
  "customers.view",
  "product.view",
  "messages.view",
  "messages.resolve",
  "emails.view",
  "emails.retry",
];

const FULFILLMENT: Permission[] = [
  "dashboard.view",
  "orders.view",
  "orders.update_status",
  "orders.update_fulfillment",
  "product.view",
  "inventory.view",
  "inventory.adjust",
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: OWNER,
  admin: ADMIN,
  support: SUPPORT,
  fulfillment: FULFILLMENT,
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  support: "Support",
  fulfillment: "Fulfillment",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: "Full access, including admin users, settings and audit logs.",
  admin: "Day-to-day operations: orders, payments, refunds, product, inventory.",
  support: "Customer support: orders, messages, emails — no money or stock changes.",
  fulfillment: "Packing & shipping: order fulfilment and inventory only.",
};

export function roleHasPermission(
  role: AdminRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function roleHasAnyPermission(
  role: AdminRole,
  candidates: Permission[],
): boolean {
  return candidates.some((permission) => roleHasPermission(role, permission));
}
