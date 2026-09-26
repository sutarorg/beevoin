import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin session management.
 * A signed, httpOnly cookie (`value = exp.signature`) is required for all
 * /admin routes and admin APIs. The password lives only in ADMIN_PASSWORD;
 * no credentials are ever stored client-side or in the database.
 */

const COOKIE_NAME = "beevo_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function sessionSecret(): string {
  // ADMIN_SESSION_SECRET is preferred; the password itself is an acceptable
  // fallback key material since it only exists server-side.
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export async function createAdminSession(): Promise<void> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const value = `${exp}.${sign(`admin:${exp}`)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`admin:${exp}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
