import { isAdmin } from "@/lib/admin-auth";
import { adminStatusSchema } from "@/lib/validations";
import { updateOrderStatus } from "@/lib/orders";
import { sendStatusEmail } from "@/lib/email/send";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return jsonError(401, "Not authorised.");
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `admin-status:${ip}`, limit: 60, windowMs: 60_000 });
  if (!limit.ok) return jsonError(429, "Too many actions. Slow down.");

  const { id } = await params;
  const body = await readJson(request);
  const parsed = adminStatusSchema.safeParse({ ...(body as object), orderId: id });
  if (!parsed.success) return jsonError(400, "Invalid status update.");

  try {
    const updated = await updateOrderStatus(parsed.data);
    if (!updated) return jsonError(404, "Order not found.");

    logEvent("admin_status_update", {
      orderNumber: updated.orderNumber,
      status: updated.status,
    });

    await sendStatusEmail(updated);
    return jsonOk({ status: updated.status });
  } catch (err) {
    logEvent("admin_status_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(500, "Could not update the order. Please try again.");
  }
}
