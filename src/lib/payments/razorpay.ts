import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration using the REST API directly (no SDK dependency).
 * Enabled only when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured.
 * Docs: https://razorpay.com/docs/api/orders/
 */

const API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const key = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function createRazorpayOrder(input: {
  amountInPaise: number;
  receipt: string;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Razorpay order creation failed (${res.status})`);
    void text;
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Server-side signature verification — the ONLY trustworthy confirmation.
 * signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fetch a payment to confirm its captured/authorized state server-side. */
export async function fetchPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string;
}> {
  const res = await fetch(`${API}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) throw new Error(`Could not fetch payment (${res.status})`);
  return (await res.json()) as {
    id: string;
    status: string;
    amount: number;
    currency: string;
    order_id: string;
  };
}
