import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase session refresh for Next.js 16 (`proxy.ts`).
 *
 * Responsibilities (per the current Supabase SSR guidance):
 *  1. Refresh the auth token by calling `supabase.auth.getClaims()`.
 *  2. Hand the refreshed token to Server Components via `request.cookies.set`.
 *  3. Hand the refreshed token to the browser via `response.cookies.set`.
 *
 * `getClaims()` verifies the JWT signature, so unlike `getSession()` its
 * result is safe to base a redirect on. Fine-grained authorisation still
 * happens server-side in `lib/auth/admin.ts` against the `admin_users` table.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Without Supabase configured there is no session to refresh. Admin pages
  // still deny access server-side, so this only avoids a hard crash.
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  const isLoginRoute = path === "/admin/login";

  if (isAdminArea && !isLoginRoute && !claims) {
    const loginUrl = new URL("/admin/login", request.url);
    if (path !== "/admin") loginUrl.searchParams.set("next", path);
    const redirect = NextResponse.redirect(loginUrl);
    // Carry the refreshed cookies and cache headers onto the new response.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) redirect.headers.set(header, value);
    }
    return redirect;
  }

  if (isAdminArea) {
    // Authenticated admin responses must never be cached by a CDN.
    supabaseResponse.headers.set(
      "cache-control",
      "private, no-store, max-age=0, must-revalidate",
    );
  }

  return supabaseResponse;
}
