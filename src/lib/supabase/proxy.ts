import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Supabase session refresh for the Next.js 16 proxy (the replacement for
 * middleware.ts). Keeps the SSR auth cookies in sync so Server Components
 * never see a stale or expired session.
 *
 * This is a convenience boundary only: /admin pages, server actions and route
 * handlers all re-verify identity AND authorization server-side.
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<{ response: NextResponse; authenticated: boolean }> {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return { response: supabaseResponse, authenticated: false };
  }

  // With Fluid compute this client must never be hoisted to module scope.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          supabaseResponse.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): anything that
  // touches cookies in between can log users out at random.
  let authenticated = false;
  try {
    const { data } = await supabase.auth.getClaims();
    authenticated = Boolean(data?.claims?.sub);
  } catch {
    authenticated = false;
  }

  return { response: supabaseResponse, authenticated };
}
