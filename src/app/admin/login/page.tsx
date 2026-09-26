import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const auth = await getAdminAuth();
  if (auth.state === "ok") redirect("/admin");
  if (auth.state === "not_admin" || auth.state === "suspended") {
    redirect("/admin/no-access");
  }
  return <AdminLoginForm />;
}
