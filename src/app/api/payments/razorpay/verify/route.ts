import { z } from "zod";
import { getOrderByNumber } from "@/lib/orders";
import { reconcileRazorpayPayment } from "@/lib/payments/reconcile";
import {
  isRazorpayConfigured,
  verifyPaymentSignature,
} from "@/lib/payments/razorpay";
import { getClientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z.object({
  orderNumber: z.string().trim().min(6).max(20),
  razorpay_order_id: z.string().trim().min(6).max(60),
  razorpay_payment_id: z.string().trim().min(6).max(60),
  razorpay_signature: z.string().trim().min(10).max(200),
});

/**
 * Browser payment callback.
 *
 * The client's "payment succeeded" signal is never trusted:
 *   1. the HMAC signature is verified,
 *   2. the Razorpay order id must match the one WE stored for this order,
 *   3. the payment is then re-fetched from Razorpay and reconciled
 *      server-side (amount, currency, capture state, single consumption).
 *
 * Duplicate calls are idempotent — the second one just reports the state.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");
  if (!isRazorpayConfigured()) return jsonError(400, "Payments are not configured.");

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `verify:${ip}`, limit: 15, windowMs: 60_000 });
  if (!limit.ok) return jsonError(429, "Too many attempts. Please slow down.");

  const body = await readJson(request);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Malformed verification request.");
  const input = parsed.data;

  const order = await getOrderByNumber(input.orderNumber);
  if (!order) return jsonError(404, "Order not found.");

  // The trusted Razorpay order id is the one stored on our order.
  if (order.razorpayOrderId && order.razorpayOrderId !== input.razorpay_order_id) {
    return jsonError(400, "Payment does not match this order.");
  }

  if (
    !verifyPaymentSignature({
      razorpayOrderId: input.razorpay_order_id,
      razorpayPaymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    })
  ) {
    logEvent("payment_failed", {
      reason: "signature_mismatch",
      orderNumber: order.orderNumber,
    });
    return jsonError(400, "Payment verification failed. No amount was confirmed.");
  }

  const outcome = await reconcileRazorpayPayment({
    source: "callback",
    razorpayPaymentId: input.razorpay_payment_id,
    razorpayOrderId: input.razorpay_order_id,
    expectedOrderNumber: order.orderNumber,
  });

  const redirect = `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`;

  switch (outcome.state) {
    case "paid":
      logEvent("payment_verified", {
        orderNumber: order.orderNumber,
        firstConfirmation: outcome.firstConfirmation,
      });
      return jsonOk({ redirect, duplicate: !outcome.firstConfirmation });
    case "pending":
      return jsonOk({
        redirect,
        pending: true,
        message:
          "Your payment is being confirmed by the bank. We'll email you as soon as it clears.",
      });
    case "failed":
      return jsonError(
        400,
        "The payment did not go through. If any amount was deducted it will be reversed automatically.",
      );
    default:
      return jsonError(
        400,
        "Payment could not be confirmed. Please contact support with your order ID.",
      );
  }
}
