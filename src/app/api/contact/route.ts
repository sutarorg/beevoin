import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { contactSchema } from "@/lib/validations";
import { sendAdminNotification } from "@/lib/email/send";
import { notificationEmail } from "@/lib/services/settings";
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

const TOPIC_LABELS: Record<string, string> = {
  general: "General enquiry",
  order: "Order help",
  shipping: "Shipping & delivery",
  replacement: "Replacement support",
  product: "Product question",
};

/**
 * Contact form.
 *
 * The durable record is our own `contact_messages` table (visible at
 * /admin/messages). Notification delivery goes through Resend — the previous
 * Web3Forms dependency has been removed. A delivery failure never loses the
 * message.
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
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        topic: input.topic,
        orderNumber: input.orderNumber ? input.orderNumber.toUpperCase() : null,
        message: input.message,
        status: "new",
      })
      .returning({ id: contactMessages.id });

    logEvent("contact_message", { topic: input.topic });

    // Notification is best-effort: the message is already safely stored.
    const to = await notificationEmail();
    const delivery = await sendAdminNotification({
      template: "contact_notification",
      to,
      eventKey: `contact:${message.id}`,
      replyTo: input.email,
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ? `+91 ${input.phone}` : "",
        topic: TOPIC_LABELS[input.topic] ?? input.topic,
        orderNumber: input.orderNumber?.toUpperCase() ?? "",
        message: input.message,
      },
    });

    if (delivery === "sent") {
      await db
        .update(contactMessages)
        .set({ notifiedAt: new Date() })
        .where(eq(contactMessages.id, message.id));
    }

    return jsonOk({
      message:
        "Thanks for writing to us — we usually reply within one business day.",
    });
  } catch (err) {
    logEvent("contact_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(500, "Something went wrong. Please try again shortly.");
  }
}
