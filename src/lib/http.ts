import { NextResponse } from "next/server";

/** Extract a best-effort client IP for rate limiting. */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Same-origin CSRF guard for JSON POST endpoints: if an Origin/Referer header
 * is present, it must match the request host. (Our forms are same-origin;
 * third-party cross-site posts would carry a foreign Origin.)
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  const origin =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return true; // server-to-server / same-site navigations
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function jsonOk(data: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...data });
}

/** Parse a JSON body safely; returns null on malformed input. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Structured server log — no PII, ever. */
export function logEvent(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...data, at: new Date().toISOString() }));
}
