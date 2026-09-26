import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, type AdminRole, type AdminUser } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission, type Permission } from "./permissions";

/**
 * Centralised admin authorisation.
 *
 * Authentication  → Supabase Auth (verified via `getClaims()`, never `getSession()`).
 * Authorisation   → the `admin_users` table in our own database.
 *
 * A signed-in Supabase user is NOT an admin: they must also have an active
 * `admin_users` row. Every sensitive read/write funnels through the helpers
 * below, so authorisation can never depend on hidden UI or client state.
 */

export type AdminAuthResult =
  | { state: "unauthenticated" }
  | { state: "not_admin"; email: string | null; userId: string }
  | { state: "suspended"; admin: AdminUser }
  | { state: "ok"; admin: AdminUser };

export class AuthorizationError extends Error {
  readonly code: "unauthenticated" | "forbidden";
  constructor(code: "unauthenticated" | "forbidden", message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

/** Per-request memoised identity lookup. */
export const getAdminAuth = cache(async (): Promise<AdminAuthResult> => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { state: "unauthenticated" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { state: "unauthenticated" };

  const userId = String(claims.sub);
  const email = typeof claims.email === "string" ? claims.email : null;

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.supabaseUserId, userId))
    .limit(1);

  if (!admin) return { state: "not_admin", email, userId };
  if (admin.status !== "active") return { state: "suspended", admin };
  return { state: "ok", admin };
});

/** Current admin, or null when the visitor isn't an authorised admin. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const auth = await getAdminAuth();
  return auth.state === "ok" ? auth.admin : null;
}

/**
 * Page-level guard. Redirects instead of throwing so admin routes behave
 * predictably in the browser.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  const auth = await getAdminAuth();
  if (auth.state === "ok") return auth.admin;
  if (auth.state === "unauthenticated") redirect("/admin/login");
  redirect("/admin/no-access");
}

export async function requirePermissionPage(
  permission: Permission,
): Promise<AdminUser> {
  const admin = await requireAdminPage();
  if (!roleHasPermission(admin.role, permission)) redirect("/admin/no-access");
  return admin;
}

/** Mutation guard for Server Actions and Route Handlers. Throws on failure. */
export async function requireAdmin(): Promise<AdminUser> {
  const auth = await getAdminAuth();
  if (auth.state === "ok") return auth.admin;
  if (auth.state === "unauthenticated") {
    throw new AuthorizationError("unauthenticated", "Sign in to continue.");
  }
  throw new AuthorizationError(
    "forbidden",
    auth.state === "suspended"
      ? "This admin account is suspended."
      : "This account is not authorised for the Beevo admin.",
  );
}

export async function requireRole(roles: AdminRole[]): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!roles.includes(admin.role)) {
    throw new AuthorizationError(
      "forbidden",
      "Your role cannot perform this action.",
    );
  }
  return admin;
}

export async function requirePermission(
  permission: Permission,
): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!roleHasPermission(admin.role, permission)) {
    throw new AuthorizationError(
      "forbidden",
      "Your role cannot perform this action.",
    );
  }
  return admin;
}

export async function can(permission: Permission): Promise<boolean> {
  const admin = await getCurrentAdmin();
  return admin ? roleHasPermission(admin.role, permission) : false;
}

export async function touchAdminLogin(adminId: string): Promise<void> {
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, adminId));
}
