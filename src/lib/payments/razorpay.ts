import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration over the REST API (no SDK dependency).
 *
 * Everything in this module is server-only. `RAZORPAY_KEY_SECRET` and
 * `RAZORPAY_WEBHOOK_SECRET` are never referenced from client code, and only
 * `RAZORPAY_KEY_ID` is ever handed to the browser (Checkout needs it).
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
  const key = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
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
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
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

/* ---------------------------------------------------------------- */

export type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid";
};

export type RazorpayPayment = {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  order_id: string | null;
  method: string | null;
  captured: boolean;
  amount_refunded: number;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
};

export type RazorpayRefund = {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  /** pending | processed | failed */
  status: string;
  speed_processed?: string;
  created_at: number;
};

export async function createRazorpayOrder(input: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return request<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      ...(input.notes ? { notes: input.notes } : {}),
    },
  });
}

export async function fetchRazorpayOrder(id: string): Promise<RazorpayOrder> {
  return request<RazorpayOrder>(`/orders/${encodeURIComponent(id)}`);
}

/** Fetch a payment to confirm its status/amount/capture state server-side. */
export async function fetchPayment(
  paymentId: string,
): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}`,
  );
}

/**
 * Capture an authorised payment.
 *
 * Razorpay accounts can be configured for automatic capture (the payment
 * arrives already `captured`) or manual capture (it arrives `authorized` and
 * must be captured within the authorisation window, or it is auto-refunded).
 * Beevo supports both: the reconciliation service only treats a payment as
 * money-in-hand once `status === "captured"`, and calls this for the manual
 * case.
 */
export async function capturePayment(
  paymentId: string,
  amountInPaise: number,
  currency = "INR",
): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}/capture`,
    { method: "POST", body: { amount: amountInPaise, currency } },
  );
}

/**
 * Create a full or partial refund. Razorpay may return `pending`; the
 * `refund.processed` / `refund.failed` webhooks finalise the state.
 */
export async function createRefund(input: {
  paymentId: string;
  amountInPaise: number;
  notes?: Record<string, string>;
  /** Razorpay rejects duplicate (payment, idempotency-key) pairs. */
  idempotencyKey?: string;
}): Promise<RazorpayRefund> {
  const res = await fetch(
    `${API}/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        ...(input.idempotencyKey
          ? { "X-Payment-Idempotency": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        amount: input.amountInPaise,
        speed: "normal",
        ...(input.notes ? { notes: input.notes } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    },
  );

  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const error = (parsed as { error?: { description?: string; code?: string } })
      ?.error;
    throw new RazorpayError(
      error?.description ?? `Refund failed (${res.status})`,
      res.status,
      error?.code,
    );
  }
  return parsed as RazorpayRefund;
}

export async function fetchRefund(
  paymentId: string,
  refundId: string,
): Promise<RazorpayRefund> {
  return request<RazorpayRefund>(
    `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`,
  );
}

/* ---------------------------------------------------------------- */

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Checkout callback signature.
 * signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 *
 * The trusted `razorpay_order_id` must come from our own database, never
 * straight from the browser — callers pass the stored value.
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
  return safeEqualHex(expected, input.signature);
}

/**
 * Webhook signature.
 * HMAC_SHA256 of the RAW request body with RAZORPAY_WEBHOOK_SECRET, hex.
 * The body must not be parsed or re-serialised before this check.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
