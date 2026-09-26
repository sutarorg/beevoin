import { z } from "zod";
import { getOrderByNumber } from "@/lib/orders";
import {
  isRazorpayConfigured,
  verifyPaymentSignature,
} from "@/lib/payments/razorpay";
import { reconcileRazorpayPayment } from "@/lib/services/payments";
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

const verifySchema = z.object({
  orderNumber: z.string().trim().min(6).max(20),
  razorpay_order_id: z.string().trim().min(6).max(60),
  razorpay_payment_id: z.string().trim().min(6).max(60),
  razorpay_signature: z.string().trim().min(10).max(200),
});

/**
 * Browser payment callback.
 *
 * The client's "payment succeeded" signal is never trusted. This endpoint:
 *
 *   1. loads the Beevo order and the Razorpay order id WE stored for it;
 *   2. verifies the HMAC signature against that stored order id — not the one
 *      the browser sent;
 *   3. hands off to the shared reconciliation service, which re-reads the
 *      payment from Razorpay and re-checks linkage, amount, currency and
 *      capture state before anything is marked paid.
 *
 * It is idempotent and order-independent with the webhook: whichever arrives
 * first confirms the order, the other is a verified no-op.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");
  if (!isRazorpayConfigured()) {
    return jsonError(400, "Payments are not configured.");
  }

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `verify:${ip}`, limit: 15, windowMs: 60_000 });
  if (!limit.ok) return jsonError(429, "Too many attempts. Please slow down.");

  const body = await readJson(request);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Malformed verification request.");
  const input = parsed.data;

  try {
    const order = await getOrderByNumber(input.orderNumber);
    if (!order) return jsonError(404, "Order not found.");

    const successUrl = `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`;

    // Already reconciled (webhook won the race, or the customer refreshed).
    if (
      order.paymentStatus === "paid" &&
      order.razorpayPaymentId === input.razorpay_payment_id
    ) {
      return jsonOk({ redirect: successUrl, duplicate: true });
    }

    // The trusted Razorpay order id comes from our database.
    const trustedRazorpayOrderId = order.razorpayOrderId;
    if (!trustedRazorpayOrderId) {
      return jsonError(400, "No payment was started for this order.");
    }
    if (trustedRazorpayOrderId !== input.razorpay_order_id) {
      logEvent("payment_order_mismatch", { orderNumber: order.orderNumber });
      return jsonError(400, "Payment does not match this order.");
    }

    const signatureOk = verifyPaymentSignature({
      razorpayOrderId: trustedRazorpayOrderId,
      razorpayPaymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!signatureOk) {
      logEvent("payment_signature_mismatch", { orderNumber: order.orderNumber });
      return jsonError(
        400,
        "Payment verification failed. No amount was confirmed.",
      );
    }

    const outcome = await reconcileRazorpayPayment({
      source: "callback",
      razorpayPaymentId: input.razorpay_payment_id,
      razorpayOrderId: trustedRazorpayOrderId,
      order,
    });

    switch (outcome.status) {
      case "confirmed":
        return jsonOk({ redirect: successUrl });
      case "pending_capture":
        return jsonOk({
          redirect: successUrl,
          pending: true,
          message:
            "Your payment is being confirmed by the bank. We'll email you the moment it clears.",
        });
      case "failed":
        return jsonError(
          400,
          "The payment did not complete. If money was deducted it will be reversed automatically — contact support with your order ID.",
        );
      default:
        logEvent("payment_state_invalid", {
          orderNumber: order.orderNumber,
          reason: outcome.reason,
        });
        return jsonError(
          400,
          "Payment could not be confirmed. If money was deducted it will be auto-refunded; contact support with your order ID.",
        );
    }
  } catch (err) {
    logEvent("verify_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(
      500,
      "Verification error. Please contact support with your order ID.",
    );
  }
}
