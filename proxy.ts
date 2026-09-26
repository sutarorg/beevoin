import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy (formerly `middleware.ts`). Keeps the Supabase Auth
 * session fresh for server-rendered admin pages and route handlers.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and the public API surface that
     * must not depend on a session (payment webhooks in particular).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
