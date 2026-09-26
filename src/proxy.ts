import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy (the successor to middleware.ts, Node.js runtime).
 *
 * Responsibilities, in order:
 *   1. Refresh the Supabase SSR session cookies on every /admin request.
 *   2. Bounce unauthenticated visitors to /admin/login before any admin page
 *      renders.
 *   3. Mark authenticated admin responses as private so no CDN, ISR or shared
 *      cache can ever store a signed-in page.
 *
 * Authorization (role + status from `admin_users`) is NOT decided here — it is
 * re-checked server-side by every page, server action and route handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, authenticated } = await updateSupabaseSession(request);

  const isLoginRoute = pathname === "/admin/login";

  if (!authenticated && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    // Preserve any refreshed auth cookies on the redirect response.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
