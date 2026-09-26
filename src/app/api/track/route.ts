import { trackSchema } from "@/lib/validations";
import {
  getOrderByNumber,
  getOrderEvents,
  toTrackingSummary,
} from "@/lib/orders";
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

const NOT_FOUND_MESSAGE =
  "We couldn't find an order with those details. Check your order ID and the mobile number or email you used while ordering.";

/**
 * Order lookup. Requires the order number PLUS one matching verification
 * factor (registered phone, registered email, or the un-guessable lookup
 * secret shared only with the buyer), so strangers can't enumerate orders.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `track:${ip}`, limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError(429, "Too many lookups. Please try again shortly.");
  }

  const body = await readJson(request);
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return jsonError(400, "Please check the details you entered.", {
      fieldErrors,
    });
  }

  const { orderNumber, phone, email, lookupSecret } = parsed.data;

  try {
    const order = await getOrderByNumber(orderNumber);
    if (!order) return jsonError(404, NOT_FOUND_MESSAGE);

    const verified =
      (lookupSecret && lookupSecret === order.lookupSecret) ||
      (phone && phone === order.phone) ||
      (email && email.toLowerCase() === order.email);

    if (!verified) {
      logEvent("track_denied", { orderNumber });
      return jsonError(404, NOT_FOUND_MESSAGE);
    }

    const events = await getOrderEvents(order.id);
    return jsonOk({ order: toTrackingSummary(order, events) });
  } catch (err) {
    logEvent("track_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(500, "Something went wrong. Please try again shortly.");
  }
}
