import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { roleHasPermission, type Permission } from "@/lib/auth/permissions";
import { signOutAction } from "@/app/admin/login/actions";
import { AdminNav } from "@/components/admin/nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Beevo admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin shell.
 *
 * `requireAdmin()` re-verifies the Supabase session AND the `admin_users` row
 * on every request — src/proxy.ts only refreshes cookies, it is never the
 * authorization boundary. Individual pages and every server action re-check
 * their own permission on top of this.
 */

const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", permission: "orders.view" },
  { href: "/admin/payments", label: "Payments", permission: "payments.view" },
  { href: "/admin/customers", label: "Customers", permission: "customers.view" },
  { href: "/admin/product", label: "Product", permission: "product.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory.view" },
  { href: "/admin/messages", label: "Messages", permission: "messages.view" },
  { href: "/admin/emails", label: "Emails", permission: "emails.view" },
  { href: "/admin/webhooks", label: "Webhooks", permission: "webhooks.view" },
  { href: "/admin/settings", label: "Settings", permission: "settings.view" },
  { href: "/admin/admins", label: "Admin users", permission: "admins.view" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  support: "Support",
  fulfillment: "Fulfillment",
};

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await requireAdmin();

  // Navigation is filtered for usability only. Hiding a link is never a
  // security control — the target page and its actions enforce the same
  // permission server-side.
  const items = NAV.filter((item) =>
    roleHasPermission(actor.role, item.permission),
  ).map(({ href, label }) => ({ href, label }));

  return (
    <div className="min-h-[70vh] bg-cream/40">
      <header className="border-b border-sandline bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-lg font-bold">
              beevo<span className="text-accent">.</span>
            </p>
            <span className="text-sm font-bold text-paper/60">admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12.5px] font-semibold text-paper/70 sm:inline">
              {actor.name} · {ROLE_LABELS[actor.role] ?? actor.role}
            </span>
            <Link
              href="/"
              className="text-[13px] font-bold text-paper/70 hover:text-paper"
            >
              View store
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-paper/30 px-3.5 py-1.5 text-[13px] font-bold hover:bg-paper/10"
              >
                <LogOut className="size-3.5" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <AdminNav items={items} />

      <div className="mx-auto max-w-7xl px-5 py-7 md:px-8">{children}</div>
    </div>
  );
}
