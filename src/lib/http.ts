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
 *
 * NOTE: provider webhooks must NOT use this — they are server-to-server and
 * are authenticated by HMAC signature instead.
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

/**
 * Structured observability log — one JSON line per meaningful event.
 *
 * Never log: passwords, Supabase keys, Razorpay secrets, the Resend API key,
 * database URLs, full addresses, full phone numbers or email bodies. Values
 * that look like credentials or PII are redacted defensively below, but the
 * primary rule is simply not to pass them in.
 */
const REDACT_KEYS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "signature",
  "email",
  "phone",
  "address",
  "databaseurl",
  "database_url",
];

function redact(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const normalized = key.toLowerCase().replace(/[^a-z_]/g, "");
    if (REDACT_KEYS.some((bad) => normalized.includes(bad))) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] =
      typeof value === "string" && value.length > 400
        ? `${value.slice(0, 400)}…`
        : value;
  }
  return out;
}

export function logEvent(event: string, data: Record<string, unknown> = {}) {
  // Structured server log — consumed by Vercel's log drain / observability.
  console.log(
    JSON.stringify({ event, ...redact(data), at: new Date().toISOString() }),
  );
}
