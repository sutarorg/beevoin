import { buildCheckoutSchema } from "@/lib/validations";
import { createOrder, markPaymentInitiated } from "@/lib/orders";
import { emailEventKey, sendOrderEmail } from "@/lib/email/send";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";
import { getCheckoutProduct, stockStateOf } from "@/lib/services/products";
import { recordPaymentAttempt } from "@/lib/services/payments";
import {
  getClientIp,
  isSameOrigin,
  jsonError,
  jsonOk,
  logEvent,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import {
  CodPhoneVerificationError,
  isCodOtpConfigured,
  parseCodVerificationToken,
} from "@/lib/cod-otp";

export const runtime = "nodejs";

/**
 * Checkout.
 *
 * Nothing commercial is read from the request: price, shipping, currency,
 * maximum quantity and stock all come from the authoritative (uncached)
 * product row. The client only chooses quantity and payment method, and both
 * are validated against the database.
 *
 * COD   : pending -> confirmed (stock reserved in the same transaction)
 * Online: pending -> payment_pending (stock reserved only once payment is
 *         verified, so abandoned checkouts never hold inventory)
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "Invalid request origin.");
  }

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `checkout:${ip}`, limit: 8, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError(
      429,
      `Too many attempts. Please wait ${limit.retryAfterSeconds}s and try again.`,
    );
  }

  const body = await readJson(request);
  if (body === null) return jsonError(400, "Malformed request body.");

  const product = await getCheckoutProduct();
  if (!product) {
    return jsonError(
      503,
      "The store is not accepting orders right now. Please try again shortly.",
    );
  }

  const parsed = buildCheckoutSchema(product.maxPerOrder).safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return jsonError(400, "Please fix the highlighted fields.", { fieldErrors });
  }

  const input = parsed.data;

  const stock = stockStateOf(product);
  if (stock === "inactive") {
    return jsonError(409, "This product is not available for purchase.");
  }
  if (stock === "out_of_stock") {
    return jsonError(409, "Beevo Go is out of stock right now.");
  }
  if (input.quantity > product.inventoryQuantity) {
    return jsonError(409, `Only ${product.inventoryQuantity} left in stock.`, {
      fieldErrors: {
        quantity: `Only ${product.inventoryQuantity} available`,
      },
    });
  }

  // Server-side money math, integer paise only. The payment method selects
  // the authoritative unit price — clients never send a price or total.
  const unitPriceInPaise =
    input.paymentMethod === "cod"
      ? product.codPriceInPaise
      : product.priceInPaise;
  const total = unitPriceInPaise * input.quantity + product.shippingInPaise;

  let codVerification: { tokenHash: string } | undefined;
  if (input.paymentMethod === "cod") {
    try {
      if (!isCodOtpConfigured()) {
        return jsonError(
          503,
          "Cash on Delivery verification is temporarily unavailable. Please pay online or contact support.",
        );
      }
      codVerification = parseCodVerificationToken(input.codOtpToken, input.phone);
    } catch (error) {
      return jsonError(
        400,
        error instanceof CodPhoneVerificationError
          ? error.message
          : "Verify your mobile number with the OTP before placing a COD order.",
        { fieldErrors: { phone: "Complete mobile verification for COD" } },
      );
    }
  }

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
      product,
      codVerification,
    });

    logEvent("order_created", {
      orderNumber: order.orderNumber,
      method: order.paymentMethod,
      total,
      deduplicated,
    });

    const successUrl = `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`;

    if (input.paymentMethod === "cod") {
      await sendOrderEmail(order, "order_confirmed", {
        eventKey: emailEventKey(order.id, "order_confirmed", "confirmed"),
      });
      return jsonOk({ mode: "cod", redirect: successUrl });
    }

    // ---- Online payment ----
    // Reuse the existing Razorpay order when the customer retries the same
    // checkout: a retry is a new payment ATTEMPT, not a new order.
    try {
      let razorpayOrderId = order.razorpayOrderId;
      if (!razorpayOrderId) {
        const rzpOrder = await createRazorpayOrder({
          amountInPaise: order.totalInPaise,
          receipt: order.orderNumber,
          notes: { beevo_order: order.orderNumber },
        });
        razorpayOrderId = rzpOrder.id;
        await markPaymentInitiated(order.id, rzpOrder.id);
      }

      await recordPaymentAttempt({
        orderId: order.id,
        providerOrderId: razorpayOrderId,
        amountInPaise: order.totalInPaise,
      });

      // Only public Checkout values leave the server.
      return jsonOk({
        mode: "razorpay",
        orderNumber: order.orderNumber,
        razorpay: {
          orderId: razorpayOrderId,
          amount: order.totalInPaise,
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
    const message = err instanceof Error ? err.message : "unknown";
    logEvent("checkout_error", { error: message });
    if (err instanceof Error && err.name === "OutOfStockError") {
      return jsonError(409, "That last unit just sold out. Please try again.");
    }
    if (err instanceof CodPhoneVerificationError) {
      return jsonError(400, err.message, {
        fieldErrors: { phone: "Complete mobile verification for COD" },
      });
    }
    return jsonError(
      500,
      "Something went wrong on our side. Please try again in a moment.",
    );
  }
}
