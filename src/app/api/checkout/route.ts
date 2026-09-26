import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { checkoutSchema } from "@/lib/validations";
import { createOrder } from "@/lib/orders";
import { sendOrderEmail } from "@/lib/email/send";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/payments/razorpay";
import { product } from "@/lib/config";
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

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "Invalid request origin.");
  }

  const ip = getClientIp(request);
  const limit = rateLimit({
    key: `checkout:${ip}`,
    limit: 8,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return jsonError(
      429,
      `Too many attempts. Please wait ${limit.retryAfterSeconds}s and try again.`,
    );
  }

  const body = await readJson(request);
  if (body === null) return jsonError(400, "Malformed request body.");

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return jsonError(400, "Please fix the highlighted fields.", { fieldErrors });
  }

  const input = parsed.data;
  const total = product.priceInPaise * input.quantity + product.shippingInPaise;

  if (input.paymentMethod === "online" && !isRazorpayConfigured()) {
    return jsonError(
      400,
      "Online payment is not available right now. Please choose Cash on Delivery.",
    );
  }

  try {
    const { order, deduplicated } = await createOrder({
      customer: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 || undefined,
        locality: input.locality,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
      },
      quantity: input.quantity,
      paymentMethod: input.paymentMethod,
    });

    logEvent("order_created", {
      orderNumber: order.orderNumber,
      method: order.paymentMethod,
      total,
      deduplicated,
    });

    const successUrl = `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`;

    if (input.paymentMethod === "cod") {
      // Only notify for genuinely new orders — deduped retries stay silent.
      if (!deduplicated) await sendOrderEmail(order, "order_confirmed");
      return jsonOk({ mode: "cod", redirect: successUrl });
    }

    // Online payment — create the Razorpay order and stash its id on ours.
    try {
      const rzpOrder = await createRazorpayOrder({
        amountInPaise: total,
        receipt: order.orderNumber,
      });
      await db
        .update(orders)
        .set({ razorpayOrderId: rzpOrder.id })
        .where(eq(orders.id, order.id));

      return jsonOk({
        mode: "razorpay",
        orderNumber: order.orderNumber,
        razorpay: {
          orderId: rzpOrder.id,
          amount: total,
          currency: "INR",
        },
      });
    } catch (err) {
      logEvent("razorpay_order_failed", {
        orderNumber: order.orderNumber,
        error: err instanceof Error ? err.message : "unknown",
      });
      return jsonError(
        502,
        "We couldn't start the payment. Please try again, or choose Cash on Delivery.",
      );
    }
  } catch (err) {
    logEvent("checkout_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(
      500,
      "Something went wrong on our side. Please try again in a moment.",
    );
  }
}
