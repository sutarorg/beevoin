import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { contactSchema } from "@/lib/validations";
import {
  getClientIp,
  isSameOrigin,
  jsonError,
  jsonOk,
  logEvent,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { forwardToWeb3Forms, web3formsKey } from "@/lib/web3forms";

export const runtime = "nodejs";

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
    await db.insert(contactMessages).values({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      topic: input.topic,
      orderNumber: input.orderNumber ? input.orderNumber.toUpperCase() : null,
      message: input.message,
    });
    logEvent("contact_message", { topic: input.topic });

    // Web3Forms delivery (emails the store owner). Server-side delivery works
    // on Pro plans; on the free tier we hand the key to this validated,
    // rate-limited client so it can complete the submission from the browser.
    let web3formsFallbackKey: string | undefined;
    let web3formsDelivered = false;
    const key = web3formsKey();
    if (key) {
      const result = await forwardToWeb3Forms(input, key);
      if (result.status === "delivered") {
        web3formsDelivered = true;
      } else if (result.status === "client-side-required") {
        web3formsFallbackKey = key;
        logEvent("web3forms_requires_client");
      } else {
        logEvent("web3forms_failed", { error: result.error });
      }
    }

    return jsonOk({
      message:
        "Thanks for writing to us — we usually reply within one business day.",
      web3formsDelivered,
      ...(web3formsFallbackKey ? { web3formsFallbackKey } : {}),
    });
  } catch (err) {
    logEvent("contact_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(500, "Something went wrong. Please try again shortly.");
  }
}
