import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration over the REST API (no SDK dependency).
 *
 * Everything here is server-only: RAZORPAY_KEY_SECRET and
 * RAZORPAY_WEBHOOK_SECRET never leave this process. The browser only ever
 * receives RAZORPAY_KEY_ID and a Razorpay order id.
 *
 * Docs: https://razorpay.com/docs/api/
 */

const API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export class RazorpayError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: authHeader(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // Razorpay is an external dependency of a user-facing request path.
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const error = (parsed as { error?: { description?: string; code?: string } })
      ?.error;
    throw new RazorpayError(
      error?.description ?? `Razorpay request failed (${res.status})`,
      res.status,
      error?.code,
    );
  }
  return parsed as T;
}

/* -------------------------------------------------------------------------
 * Entities
 * ---------------------------------------------------------------------- */

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
  status: string;
  attempts?: number;
};

export type RazorpayPayment = {
  id: string;
  entity: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  amount: number;
  currency: string;
  order_id: string | null;
  method?: string;
  captured?: boolean;
  amount_refunded?: number;
  error_code?: string | null;
  error_description?: string | null;
};

export type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  /** pending | processed | failed */
  status: string;
  speed_processed?: string;
  created_at?: number;
};

/* -------------------------------------------------------------------------
 * Operations
 * ---------------------------------------------------------------------- */

export function createRazorpayOrder(input: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return request<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    },
  });
}

export function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  return request<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`);
}

/** Fetch a payment to confirm its amount/currency/capture state server-side. */
export function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * Capture an authorized payment. Required when the Razorpay account is not
 * set to auto-capture; harmless to skip when it is (the payment arrives
 * already `captured`).
 */
export function capturePayment(input: {
  paymentId: string;
  amountInPaise: number;
  currency?: string;
}): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(
    `/payments/${encodeURIComponent(input.paymentId)}/capture`,
    {
      method: "POST",
      body: { amount: input.amountInPaise, currency: input.currency ?? "INR" },
    },
  );
}

/** Full or partial refund of a captured payment. Server-side only. */
export function createRefund(input: {
  paymentId: string;
  amountInPaise: number;
  receipt?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayRefund> {
  return request<RazorpayRefund>(
    `/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      body: {
        amount: input.amountInPaise,
        speed: "normal",
        receipt: input.receipt,
        notes: input.notes ?? {},
      },
    },
  );
}

/* -------------------------------------------------------------------------
 * Signatures
 * ---------------------------------------------------------------------- */

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Checkout callback signature:
 *   HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
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
  return safeEqual(expected, input.signature);
}

/**
 * Webhook signature: HMAC_SHA256(raw request body, webhook secret).
 * The body MUST be the raw string — never a re-serialised object.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
