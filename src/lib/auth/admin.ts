import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, type AdminRole } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logEvent } from "@/lib/http";
import { roleHasPermission, type Permission } from "./permissions";

/**
 * Centralised admin authorization.
 *
 * Authentication (Supabase Auth) answers "who are you".
 * Authorization (`admin_users` + role matrix) answers "what may you do".
 * An authenticated Supabase user who is not an active row in `admin_users`
 * is NOT an admin — customers can never become admins.
 *
 * Nothing here trusts the browser: no cookies we sign ourselves, no
 * localStorage, no query parameters, no client-supplied role.
 */

export type AdminActor = {
  id: string;
  supabaseUserId: string;
  email: string;
  name: string;
  role: AdminRole;
};

export type AdminAuthResult =
  | { ok: true; actor: AdminActor }
  | {
      ok: false;
      reason: "unconfigured" | "unauthenticated" | "not_admin" | "suspended";
    };

/**
 * Resolves the verified admin for the current request.
 *
 * Uses `getClaims()` — asymmetric-JWT verification of the access token — as
 * recommended by Supabase, falling back to `getUser()` (a round-trip to the
 * Auth server) when claims are unavailable. `getSession()` is never used for
 * an authorization decision because its contents are not verified.
 *
 * Memoised per request with React `cache` so a page that calls it from the
 * layout and several components performs one lookup.
 */
export const getAdminAuth = cache(async function getAdminAuth(): Promise<AdminAuthResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unconfigured" };

  let supabaseUserId: string | null = null;
  let authEmail: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims?.sub) {
      supabaseUserId = String(data.claims.sub);
      authEmail =
        typeof data.claims.email === "string" ? data.claims.email : null;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        supabaseUserId = userData.user.id;
        authEmail = userData.user.email ?? null;
      }
    }
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }

  if (!supabaseUserId) return { ok: false, reason: "unauthenticated" };

  const [record] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.supabaseUserId, supabaseUserId))
    .limit(1);

  if (!record) {
    logEvent("admin_access_denied", { reason: "not_in_admin_users" });
    return { ok: false, reason: "not_admin" };
  }
  if (record.status !== "active") {
    logEvent("admin_access_denied", { reason: "suspended", role: record.role });
    return { ok: false, reason: "suspended" };
  }

  return {
    ok: true,
    actor: {
      id: record.id,
      supabaseUserId,
      email: record.email || (authEmail ?? ""),
      name: record.name,
      role: record.role,
    },
  };
});

/** Page/layout guard: redirects instead of throwing. */
export async function requireAdmin(): Promise<AdminActor> {
  const result = await getAdminAuth();
  if (result.ok) return result.actor;

  if (result.reason === "unauthenticated" || result.reason === "unconfigured") {
    redirect("/admin/login");
  }
  redirect(`/admin/denied?reason=${result.reason}`);
}

/** Page guard requiring one of the given roles. */
export async function requireRole(
  ...roles: AdminRole[]
): Promise<AdminActor> {
  const actor = await requireAdmin();
  if (!roles.includes(actor.role)) redirect("/admin/denied?reason=role");
  return actor;
}

/** Page guard requiring a specific capability. */
export async function requirePermission(
  permission: Permission,
): Promise<AdminActor> {
  const actor = await requireAdmin();
  if (!roleHasPermission(actor.role, permission)) {
    redirect(`/admin/denied?reason=permission&need=${permission}`);
  }
  return actor;
}

/**
 * Mutation guard for Server Actions and Route Handlers: throws
 * `AdminAuthError` instead of redirecting, so the caller can return a clean
 * error to the client.
 */
export class AdminAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export async function authorize(permission: Permission): Promise<AdminActor> {
  const result = await getAdminAuth();
  if (!result.ok) {
    throw new AdminAuthError(
      result.reason === "suspended"
        ? "This admin account is suspended."
        : "You are not signed in as an administrator.",
      result.reason === "unauthenticated" ? 401 : 403,
    );
  }
  if (!roleHasPermission(result.actor.role, permission)) {
    throw new AdminAuthError(
      "Your role does not allow this action.",
      403,
    );
  }
  return result.actor;
}

export function can(actor: AdminActor, permission: Permission): boolean {
  return roleHasPermission(actor.role, permission);
}
