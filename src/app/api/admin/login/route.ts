import { adminLoginSchema } from "@/lib/validations";
import {
  adminConfigured,
  createAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import {
  getClientIp,
  isSameOrigin,
  jsonError,
  jsonOk,
  logEvent,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");

  if (!adminConfigured()) {
    return jsonError(
      503,
      "Admin access is not configured on this deployment.",
    );
  }

  const ip = getClientIp(request);
  const limit = rateLimit({
    key: `admin-login:${ip}`,
    limit: 5,
    windowMs: 5 * 60_000,
  });
  if (!limit.ok) {
    return jsonError(429, "Too many attempts. Try again in a few minutes.");
  }

  const body = await readJson(request);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Enter the admin password.");

  if (!verifyAdminPassword(parsed.data.password)) {
    logEvent("admin_login_failed", { ip });
    return jsonError(401, "Incorrect password.");
  }

  await createAdminSession();
  logEvent("admin_login", { ip });
  return jsonOk({ redirect: "/admin" });
}
