"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { adminLoginSchema } from "@/lib/validations";
import { recordAudit } from "@/lib/services/audit";
import { logEvent } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export type LoginState = { ok: boolean; message: string } | null;

/**
 * Admin sign-in.
 *
 * Supabase Auth verifies the credentials and sets its own httpOnly session
 * cookies; Beevo then checks that the authenticated user is an ACTIVE row in
 * `admin_users`. Both must pass. There is no Beevo-issued auth cookie, no
 * shared admin password and no way to become an admin by signing up.
 *
 * Failures are deliberately generic: the response never reveals whether an
 * email exists, whether the password was wrong, or whether the account exists
 * in Supabase but is not an admin.
 */
export async function signInAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message:
        "Supabase Auth is not configured on this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter your admin email and password." };
  }

  const email = parsed.data.email.toLowerCase();

  // Per-instance throttle. Supabase Auth applies its own global rate limits;
  // this only blunts naive local hammering (see src/lib/rate-limit.ts).
  const limit = rateLimit({ key: `admin-login:${email}`, limit: 8, windowMs: 300_000 });
  if (!limit.ok) {
    return {
      ok: false,
      message: `Too many sign-in attempts. Try again in ${Math.ceil(
        limit.retryAfterSeconds / 60,
      )} minute(s).`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    logEvent("admin_login_failed", { reason: "bad_credentials" });
    return { ok: false, message: "Invalid email or password." };
  }

  const [record] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.supabaseUserId, data.user.id))
    .limit(1);

  if (!record || record.status !== "active") {
    // Authenticated with Supabase but not an active Beevo admin — end the
    // session immediately so no half-signed-in state lingers.
    await supabase.auth.signOut();
    logEvent("admin_login_denied", {
      reason: record ? "suspended" : "not_admin",
    });
    return {
      ok: false,
      message: record
        ? "This admin account is suspended. Contact the store owner."
        : "This account does not have admin access.",
    };
  }

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, record.id));

  await recordAudit(
    { id: record.id, email: record.email },
    {
      action: "admin_login",
      entityType: "admin_user",
      entityId: record.id,
      metadata: { role: record.role },
    },
  );

  logEvent("admin_login", { role: record.role });
  redirect("/admin");
}

/** Ends the Supabase session and returns to the sign-in screen. */
export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Already signed out or Supabase unreachable — still send them away.
    }
  }
  redirect("/admin/login");
}
