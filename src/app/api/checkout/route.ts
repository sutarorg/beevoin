import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { checkoutSchema } from "@/lib/validations";
import { createOrder, transitionOrder } from "@/lib/orders";
import { getPrimaryProduct } from "@/lib/product";
import { stockStateOf, orderTotalInPaise } from "@/lib/product-view";
import { InsufficientStockError } from "@/lib/inventory";
import { sendAdminNewOrderEmail, sendOrderEmail } from "@/lib/email/send";
import { notifyLowStock, recordPaymentAttempt } from "@/lib/payments/reconcile";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";
import { getClientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { logError, logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checkout.
 *
 * The server owns every number: the product row is read fresh from the
 * database, the total is computed here, and the client's idea of price,
 * currency or stock is ignored completely.
 *
 * COD:     pending → confirmed (stock committed immediately)
 * Online:  pending → payment_pending → confirmed (after verified payment)
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "Invalid request origin.");
  }

  const ip = getClientIp(request);
  const limit = rateLimit({ key: `checkout:${ip}`, limit: 8, windowMs: 60_000 });
  if (!limit.ok) {
    logEvent("rate_limited", { route: "checkout" });
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

  try {
    // 1. Authoritative product read — never cached for checkout.
    const product = await getPrimaryProduct();
    if (!product) {
      return jsonError(503, "The store is not ready to take orders yet.");
    }

    const stock = stockStateOf(product);
    if (stock === "inactive") {
      logEvent("checkout_rejected", { reason: "inactive" });
      return jsonError(400, "This product is currently unavailable.");
    }
    if (stock === "out_of_stock") {
      logEvent("checkout_rejected", { reason: "out_of_stock" });
      return jsonError(409, "Sorry — the Beevo Go just went out of stock.");
    }
    if (input.quantity > product.maxPerOrder) {
      return jsonError(400, `Maximum ${product.maxPerOrder} units per order.`, {
        fieldErrors: { quantity: `Maximum ${product.maxPerOrder} per order` },
      });
    }
    if (input.quantity > product.inventoryQuantity) {
      return jsonError(
        409,
        `Only ${product.inventoryQuantity} unit${product.inventoryQuantity === 1 ? "" : "s"} left in stock.`,
        { fieldErrors: { quantity: "Reduce the quantity" } },
      );
    }

    if (input.paymentMethod === "online" && !isRazorpayConfigured()) {
      return jsonError(
        400,
        "Online payment is not available right now. Please choose Cash on Delivery.",
      );
    }

    // 2. Create the order (server-side pricing, snapshots, line item).
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
    });

    const total = orderTotalInPaise({
      unitPriceInPaise: order.unitPriceInPaise,
      quantity: order.quantity,
      shippingInPaise: order.shippingInPaise,
    });

    logEvent("order_created", {
      orderNumber: order.orderNumber,
      method: order.paymentMethod,
      total,
      deduplicated,
    });

    const successUrl = `/order/success?order=${order.orderNumber}&key=${order.lookupSecret}`;

    /* ---------------- Cash on Delivery ---------------- */
    if (input.paymentMethod === "cod") {
      if (!deduplicated) {
        try {
          await transitionOrder({
            orderId: order.id,
            to: "confirmed",
            actor: { type: "customer" },
            note: "Cash on Delivery order confirmed",
            dedupeKey: `${order.id}:cod_confirmed`,
          });
        } catch (err) {
          if (err instanceof InsufficientStockError) {
            await transitionOrder({
              orderId: order.id,
              to: "cancelled",
              actor: { type: "system", label: "stock" },
              note: "Cancelled automatically: stock ran out before confirmation",
              dedupeKey: `${order.id}:stock_cancelled`,
            });
            return jsonError(
              409,
              "Sorry — the last unit sold out while you were checking out. Nothing was charged.",
            );
          }
          throw err;
        }

        const [confirmed] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, order.id))
          .limit(1);
        await sendOrderEmail(confirmed, "order_confirmed");
        await sendAdminNewOrderEmail(confirmed);
        await notifyLowStock(confirmed.productId);
      }
      return jsonOk({ mode: "cod", redirect: successUrl });
    }

    /* ---------------- Online payment ---------------- */
    try {
      // Reuse the Razorpay order when the customer retries the same checkout.
      let razorpayOrderId = order.razorpayOrderId;
      if (!razorpayOrderId) {
        const rzpOrder = await createRazorpayOrder({
          amountInPaise: total,
          receipt: order.orderNumber,
          notes: { orderNumber: order.orderNumber },
        });
        razorpayOrderId = rzpOrder.id;
        await db
          .update(orders)
          .set({ razorpayOrderId, updatedAt: new Date() })
          .where(eq(orders.id, order.id));
        logEvent("payment_order_created", { orderNumber: order.orderNumber });
      }

      await recordPaymentAttempt({
        orderId: order.id,
        razorpayOrderId,
        amountInPaise: total,
      });

      if (order.status === "pending") {
        await transitionOrder({
          orderId: order.id,
          to: "payment_pending",
          actor: { type: "customer" },
          note: "Razorpay checkout opened",
          dedupeKey: `${order.id}:payment_pending`,
        });
      }

      return jsonOk({
        mode: "razorpay",
        orderNumber: order.orderNumber,
        razorpay: {
          orderId: razorpayOrderId,
          amount: total,
          currency: "INR",
        },
      });
    } catch (err) {
      logError("payment_failed", err, {
        orderNumber: order.orderNumber,
        stage: "create_order",
      });
      return jsonError(
        502,
        "We couldn't start the payment. Please try again, or choose Cash on Delivery.",
      );
    }
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return jsonError(409, "That quantity is no longer available.");
    }
    logError("checkout_error", err);
    return jsonError(
      500,
      "Something went wrong on our side. Please try again in a moment.",
    );
  }
}
