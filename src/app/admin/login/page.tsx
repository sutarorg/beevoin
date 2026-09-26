import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getAdminAuth } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const auth = await getAdminAuth();
  if (auth.ok) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-14">
      <div className="mb-7 text-center">
        <p className="font-display text-2xl font-bold text-ink">
          beevo<span className="text-accent">.</span>
        </p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">
          Admin sign in
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Staff access only. All actions in this panel are audit-logged.
        </p>
      </div>
      <div className="rounded-2xl border border-sandline bg-white p-6 shadow-[0_1px_2px_rgb(29_25_18/0.04)]">
        <AdminLoginForm configured={isSupabaseConfigured()} />
      </div>
    </div>
  );
}
