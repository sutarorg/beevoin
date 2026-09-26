"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { touchAdminLogin } from "@/lib/auth/admin";
import { logEvent } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { adminLoginSchema } from "@/lib/validations";
import type { LoginState } from "../action-state";

/**
 * Admin sign-in.
 *
 * Supabase Auth proves *who* you are; the `admin_users` table decides whether
 * you may enter. A valid Supabase user with no active admin row is signed
 * straight back out, so the session cookie is never left behind.
 */
export async function signInAction(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Enter your admin email and password." };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return {
      error:
        "Supabase Auth is not configured on this deployment. See README → Supabase setup.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    logEvent("admin_login_failure", { reason: "bad_credentials" });
    // Deliberately vague: never reveal whether the email exists.
    return { error: "Incorrect email or password." };
  }

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.supabaseUserId, data.user.id))
    .limit(1);

  if (!admin || admin.status !== "active") {
    await supabase.auth.signOut();
    logEvent("admin_login_failure", {
      reason: admin ? "suspended" : "not_admin",
    });
    return {
      error: admin
        ? "This admin account is suspended."
        : "This account is not authorised for the Beevo admin.",
    };
  }

  await touchAdminLogin(admin.id);
  await recordAudit({
    admin,
    action: "admin_login",
    entityType: "session",
    entityId: admin.id,
  });
  logEvent("admin_login_success", { role: admin.role });

  redirect("/admin");
}
