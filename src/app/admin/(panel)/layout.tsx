import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Beevo admin" },
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  async function logout() {
    "use server";
    const { clearAdminSession } = await import("@/lib/admin-auth");
    await clearAdminSession();
    redirect("/admin/login");
  }

  return (
    <div className="min-h-[60vh] bg-cream/40">
      <div className="border-b border-sandline bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <p className="font-display text-lg font-bold">
            beevo<span className="text-accent">.</span>{" "}
            <span className="text-sm font-sans font-bold text-paper/60">
              admin
            </span>
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[13px] font-bold text-paper/70 hover:text-paper"
            >
              View store
            </Link>
            <form action={logout}>
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
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
