import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase server client for Server Components, Server Actions and Route
 * Handlers (current @supabase/ssr API — the deprecated auth-helpers package
 * is not used anywhere in this codebase).
 *
 * A fresh client is created per request: with Fluid/serverless compute a
 * module-level singleton would leak one visitor's session into another's.
 */
export async function createSupabaseServerClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: src/proxy.ts refreshes the session cookies.
        }
      },
    },
  });
}
