import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { contactSchema } from "@/lib/validations";
import { sendAdminContactEmail } from "@/lib/email/send";
import { getClientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { logError, logEvent } from "@/lib/logger";
import { normaliseEmail, normalisePhone } from "@/lib/customers";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contact form. Messages are stored in `contact_messages` (the durable
 * record, visible at /admin/messages) and forwarded to the store's
 * notification address through Resend.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `contact:${ip}`, limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError(429, "Too many messages. Please try again in a minute.");
  }

  const body = await readJson(request);
  if (body === null) return jsonError(400, "Malformed request body.");

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return jsonError(400, "Please fix the highlighted fields.", { fieldErrors });
  }

  const input = parsed.data;

  try {
    const [message] = await db
      .insert(contactMessages)
      .values({
        name: input.name,
        email: normaliseEmail(input.email),
        phone: normalisePhone(input.phone || null),
        topic: input.topic,
        orderNumber: input.orderNumber ? input.orderNumber.toUpperCase() : null,
        message: input.message,
        status: "new",
      })
      .returning();

    logEvent("contact_message_received", { topic: input.topic });

    // Delivery failures never fail the customer's submission: the message is
    // already stored and visible in the admin.
    await sendAdminContactEmail({
      messageId: message.id,
      name: message.name,
      email: message.email,
      phone: message.phone,
      topic: message.topic,
      orderNumber: message.orderNumber,
      message: message.message,
    });

    return jsonOk({
      message:
        "Thanks for writing to us — we usually reply within one business day.",
    });
  } catch (err) {
    logError("internal_error", err, { route: "contact" });
    return jsonError(500, "Something went wrong. Please try again shortly.");
  }
}
