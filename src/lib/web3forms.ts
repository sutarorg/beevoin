import type { ContactInput } from "./validations";

/**
 * Web3Forms delivery for contact messages.
 *
 * The durable record of every message lives in our own `contact_messages`
 * table (see /api/contact). Web3Forms is an additional delivery channel that
 * emails the store owner.
 *
 * Note on plans: Web3Forms' free tier only accepts submissions from the
 * browser (it rejects server-to-server posts). This module therefore prefers
 * a server-side attempt — which succeeds on Pro plans — and the API route
 * falls back to revealing the key to the already-validated, rate-limited
 * client so it can finish delivery from the browser. The key is treated as
 * server-side configuration and is never embedded in source or sent to
 * arbitrary clients.
 */

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

export function web3formsKey(): string | null {
  return process.env.WEB3FORMS_ACCESS_KEY ?? null;
}

export type Web3FormsPayload = ReturnType<typeof buildPayload>;

export function buildPayload(input: ContactInput, accessKey: string) {
  const topicLabels: Record<string, string> = {
    general: "General enquiry",
    order: "Order help",
    shipping: "Shipping & delivery",
    returns: "Returns & refunds",
    product: "Product question",
  };

  const lines = [
    `Topic: ${topicLabels[input.topic] ?? input.topic}`,
    input.orderNumber ? `Order ID: ${input.orderNumber}` : null,
    input.phone ? `Phone: +91 ${input.phone}` : "Phone: not provided",
    "",
    input.message,
  ].filter((line): line is string => line !== null);

  return {
    access_key: accessKey,
    from_name: "Beevo store contact form",
    subject: `Beevo contact — ${topicLabels[input.topic] ?? input.topic}${
      input.orderNumber ? ` (${input.orderNumber.toUpperCase()})` : ""
    }`,
    name: input.name,
    email: input.email,
    replyto: input.email,
    message: lines.join("\n"),
  };
}

export type Web3FormsResult =
  | { status: "delivered" }
  | { status: "client-side-required" }
  | { status: "failed"; error: string };

export async function forwardToWeb3Forms(
  input: ContactInput,
  accessKey: string,
): Promise<Web3FormsResult> {
  try {
    const res = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Cloudflare in front of Web3Forms often challenges UA-less clients.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(buildPayload(input, accessKey)),
      signal: AbortSignal.timeout(8000),
    });

    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;

    if (res.ok && data?.success) return { status: "delivered" };

    // Non-JSON responses (Cloudflare challenge / edge block) mean the
    // browser channel is the reliable one — hand off to the client.
    if (data === null) return { status: "client-side-required" };

    const message = data.message ?? `HTTP ${res.status}`;
    if (/client side|server ip|not allowed/i.test(message)) {
      return { status: "client-side-required" };
    }
    return { status: "failed", error: message };
  } catch (err) {
    // Network-level failure from this server: the browser may still reach
    // Web3Forms, so prefer the client channel over dropping the delivery.
    const error = err instanceof Error ? err.message : "Network error";
    if (/abort|timeout/i.test(error)) return { status: "failed", error };
    return { status: "client-side-required" };
  }
}
