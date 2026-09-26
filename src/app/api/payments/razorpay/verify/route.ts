import { z } from "zod";
import {
  getOrderByNumber,
  markOrderPaid,
  markOrderPaymentFailed,
} from "@/lib/orders";
import { sendOrderEmail } from "@/lib/email/send";
import {
  fetchPayment,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from "@/lib/payments/razorpay";
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
  orderNumber: z.string().min(6).max(20),
  razorpay_order_id: z.string().min(6).max(60),
  razorpay_payment_id: z.string().min(6).max(60),
  razorpay_signature: z.string().min(10).max(200),
});

/**
 * Server-side payment verification. The client's "payment succeeded" signal
 * is never trusted — we re-verify the HMAC signature and then confirm the
 * payment's status/amount directly with Razorpay before marking paid.
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

  try {
    const order = await getOrderByNumber(input.orderNumber);
    if (!order) return jsonError(404, "Order not found.");

    // Idempotency: a duplicate verification of the same paid payment is a no-op.
    if (
      order.paymentStatus === "paid" &&
      order.razorpayPaymentId === input.razorpay_payment_id
    ) {
      return jsonOk({
        redirect: `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`,
        duplicate: true,
      });
    }

    if (
      order.razorpayOrderId &&
      order.razorpayOrderId !== input.razorpay_order_id
    ) {
      return jsonError(400, "Payment does not match this order.");
    }

    // 1) Signature check.
    const signatureOk = verifyPaymentSignature({
      razorpayOrderId: input.razorpay_order_id,
      razorpayPaymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!signatureOk) {
      logEvent("payment_signature_mismatch", { orderNumber: order.orderNumber });
      if (order.paymentStatus === "pending") {
        await markOrderPaymentFailed(order);
      }
      return jsonError(400, "Payment verification failed. No amount was confirmed.");
    }

    // 2) Confirm status + amount with Razorpay directly.
    const payment = await fetchPayment(input.razorpay_payment_id);
    const amountMatches = payment.amount === order.totalInPaise;
    const statusOk = payment.status === "captured" || payment.status === "authorized";

    if (!statusOk || !amountMatches || payment.currency !== "INR") {
      logEvent("payment_state_invalid", {
        orderNumber: order.orderNumber,
        status: payment.status,
        amountMatches,
      });
      if (order.paymentStatus === "pending") await markOrderPaymentFailed(order);
      return jsonError(
        400,
        "Payment could not be confirmed. If money was deducted it will be auto-refunded; contact support with your order ID.",
      );
    }

    const updated = await markOrderPaid(order, input.razorpay_payment_id);
    logEvent("payment_paid", { orderNumber: order.orderNumber });
    await sendOrderEmail(updated, "payment_received");

    return jsonOk({
      redirect: `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`,
    });
  } catch (err) {
    logEvent("verify_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(500, "Verification error. Please contact support with your order ID.");
  }
}
