/**
 * Supabase Auth configuration.
 *
 * Beevo uses Supabase for IDENTITY ONLY. Application data stays in
 * PostgreSQL behind Drizzle, so the publishable key is the only Supabase
 * credential the app needs — there is no privileged server-side Supabase
 * operation, and therefore no SUPABASE_SECRET_KEY anywhere in this codebase.
 *
 * Naming follows current Supabase terminology (publishable / secret keys);
 * the legacy `anon` / `service_role` naming is deprecated through 2026.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** True when the deployment has Supabase Auth configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function requireSupabaseEnv(): { url: string; key: string } {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}
