import type { AdminRole } from "@/db/schema";

/**
 * Beevo admin permission matrix.
 *
 * Pure data + pure functions — no database, no cookies — so it can be shared
 * with client components for *rendering* decisions. Rendering decisions are
 * never authorization: every mutation re-checks the same matrix on the server
 * via `requirePermission()`.
 */

export const PERMISSIONS = [
  "dashboard.view",

  "orders.view",
  "orders.update_status",
  "orders.update_fulfillment",
  "orders.cancel",

  "customers.view",

  "payments.view",
  "refunds.view",
  "refunds.create",

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

export type Permission = (typeof PERMISSIONS)[number];

const OWNER: Permission[] = [...PERMISSIONS];

const ADMIN: Permission[] = [
  "dashboard.view",
  "orders.view",
  "orders.update_status",
  "orders.update_fulfillment",
  "orders.cancel",
  "customers.view",
  "payments.view",
  "refunds.view",
  "refunds.create",
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
  // Deliberately absent: settings.update, admins.view, admins.manage —
  // owner-level administrator access cannot be changed by an admin.
];

const SUPPORT: Permission[] = [
  "dashboard.view",
  "orders.view",
  "customers.view",
  "messages.view",
  "messages.resolve",
  "emails.view",
  "emails.retry",
  // No refunds, no pricing, no inventory, no admin management, no settings.
];

const FULFILLMENT: Permission[] = [
  "dashboard.view",
  "orders.view",
  "orders.update_status",
  "orders.update_fulfillment",
  "inventory.view",
  "inventory.adjust",
  "product.view",
  // No payment data, no refunds, no customers list, no admin management,
  // no pricing, no settings.
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
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
  owner: "Complete administrative access, including settings and admin users.",
  admin: "Operational access: orders, refunds, product, inventory, messages.",
  support: "Customer and order support. No refunds, pricing or inventory.",
  fulfillment: "Shipping, tracking and inventory. No payment or pricing access.",
};

export function roleHasPermission(
  role: AdminRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Admin navigation, filtered by the signed-in role. */
export const ADMIN_NAV: ReadonlyArray<{
  href: string;
  label: string;
  permission: Permission;
}> = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", permission: "orders.view" },
  { href: "/admin/payments", label: "Payments", permission: "payments.view" },
  { href: "/admin/customers", label: "Customers", permission: "customers.view" },
  { href: "/admin/product", label: "Product", permission: "product.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory.view" },
  { href: "/admin/messages", label: "Messages", permission: "messages.view" },
  { href: "/admin/emails", label: "Emails", permission: "emails.view" },
  { href: "/admin/webhooks", label: "Webhooks", permission: "webhooks.view" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/users", label: "Admin users", permission: "admins.view" },
  { href: "/admin/settings", label: "Settings", permission: "settings.view" },
];
