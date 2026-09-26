import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin";
import { roleHasPermission, type Permission } from "@/lib/auth/permissions";
import { signOutAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Beevo admin" },
  robots: { index: false, follow: false },
};

const NAV: Array<{ href: string; label: string; permission: Permission }> = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", permission: "orders.view" },
  { href: "/admin/payments", label: "Payments", permission: "payments.view" },
  { href: "/admin/refunds", label: "Refunds", permission: "refunds.view" },
  { href: "/admin/customers", label: "Customers", permission: "customers.view" },
  { href: "/admin/product", label: "Product", permission: "product.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory.view" },
  { href: "/admin/emails", label: "Emails", permission: "emails.view" },
  { href: "/admin/messages", label: "Messages", permission: "messages.view" },
  { href: "/admin/webhooks", label: "Webhooks", permission: "webhooks.view" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/admins", label: "Admins", permission: "admins.manage" },
  { href: "/admin/settings", label: "Settings", permission: "settings.view" },
];

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdminPage();
  const items = NAV.filter((item) =>
    roleHasPermission(admin.role, item.permission),
  );

  return (
    <div className="min-h-[60vh] bg-cream/40">
      <div className="border-b border-sandline bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link href="/admin" className="font-display text-lg font-bold">
            beevo<span className="text-accent">.</span>{" "}
            <span className="font-sans text-sm font-bold text-paper/60">
              admin
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-[12px] font-bold text-paper/60 sm:inline">
              {admin.email} · {admin.role}
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
                className="inline-flex items-center gap-1.5 rounded-full border border-paper/30 px-4 py-1.5 text-[13px] font-bold hover:bg-paper/10"
              >
                <LogOut className="size-3.5" aria-hidden />
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="border-b border-sandline bg-paper"
      >
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2 md:px-8">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-ink-soft hover:bg-cream hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
