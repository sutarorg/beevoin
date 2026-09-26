import type { Order } from "@/db/schema";
import { site } from "../config";
import type { StoreSettings } from "../settings";
import { escapeHtml, formatINR } from "../format";
import { STATUS_META } from "../order-status";

/**
 * Responsive, table-based transactional email templates with inline CSS
 * (required for email-client compatibility). Never promotional — each email
 * is triggered by a real order or operational event.
 *
 * The visual design is unchanged from Beevo v1; only the data plumbing moved
 * (store copy now comes from settings instead of hard-coded constants).
 */

const ACCENT = "#E4520E";
const INK = "#1D1912";

export type EmailContext = {
  settings: StoreSettings;
  siteUrl: string;
};

function trackUrl(order: Order, ctx: EmailContext): string {
  return `${ctx.siteUrl}/track?order=${encodeURIComponent(order.orderNumber)}&key=${order.lookupSecret}`;
}

function shell(opts: {
  preheader: string;
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  ctx: EmailContext;
}): string {
  const { ctx } = opts;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#F4EEE3;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EEE3;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8E0D0;">
  <tr><td style="background:${INK};padding:20px 28px;">
    <span style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">beevo<span style="color:${ACCENT};">.</span></span>
  </td></tr>
  <tr><td style="padding:32px 28px 8px;">
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:${INK};">${opts.heading}</h1>
    ${opts.body}
  </td></tr>
  ${
    opts.ctaUrl
      ? `<tr><td style="padding:24px 28px 8px;">
    <a href="${opts.ctaUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:13px 26px;border-radius:999px;">${escapeHtml(opts.ctaLabel ?? "Track your order")}</a>
  </td></tr>`
      : ""
  }
  <tr><td style="padding:28px;">
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;color:#8A8172;line-height:1.6;">
      Ordered from ${escapeHtml(ctx.settings.storeName)} — ${escapeHtml(site.tagline)}<br>
      Questions? Write to <a href="mailto:${escapeHtml(ctx.settings.supportEmail)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(ctx.settings.supportEmail)}</a> (${escapeHtml(ctx.settings.supportHours)}).
    </p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#B0A793;">
      This is a transactional email about your order. Please don't reply directly to this message.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function orderSummary(order: Order, ctx: EmailContext): string {
  const e = escapeHtml;
  const payLine =
    order.paymentMethod === "cod"
      ? `Pay <strong>${formatINR(order.totalInPaise)}</strong> by cash or UPI when your order arrives.`
      : `Paid online — <strong>${formatINR(order.totalInPaise)}</strong> received.`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px dashed #D9CFC0;border-radius:12px;">
  <tr><td style="padding:16px 18px;">
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#8A8172;">Order</p>
    <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:${INK};">${e(order.orderNumber)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:${INK};">
      <tr><td style="padding:6px 0;">${e(order.productName)} × ${order.quantity}</td>
          <td align="right" style="padding:6px 0;">${formatINR(order.unitPriceInPaise * order.quantity)}</td></tr>
      <tr><td style="padding:6px 0;color:#57503F;">Shipping</td>
          <td align="right" style="padding:6px 0;color:#1B7F4D;font-weight:700;">${order.shippingInPaise === 0 ? "FREE" : formatINR(order.shippingInPaise)}</td></tr>
      <tr><td style="padding:10px 0 4px;border-top:1px dashed #D9CFC0;font-weight:700;">Total</td>
          <td align="right" style="padding:10px 0 4px;border-top:1px dashed #D9CFC0;font-weight:700;font-size:16px;">${formatINR(order.totalInPaise)}</td></tr>
    </table>
  </td></tr>
</table>
<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#8A8172;">Delivering to</p>
<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:${INK};">
  ${e(order.customerName)}<br>${e(order.addressLine1)}${order.addressLine2 ? `<br>${e(order.addressLine2)}` : ""}<br>${e(order.locality)}, ${e(order.city)}<br>${e(order.state)} — ${e(order.pincode)}<br>Mobile: ${e(order.phone)}
</p>
<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:${INK};">${payLine}</p>
<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#8A8172;">Estimated delivery: ${escapeHtml(ctx.settings.deliveryEstimate)} after dispatch.</p>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:${INK};">${text}</p>`;
}

function courierBlock(order: Order): string {
  if (!order.courierName && !order.trackingId) return "";
  return `<p style="margin:12px 0;padding:12px 16px;background:#F7F3EB;border-radius:10px;font-family:Arial,sans-serif;font-size:14px;color:${INK};">
    ${order.courierName ? `Courier: <strong>${escapeHtml(order.courierName)}</strong>` : ""}
    ${order.courierName && order.trackingId ? "<br>" : ""}
    ${order.trackingId ? `Tracking ID: <strong style="font-family:'Courier New',monospace;">${escapeHtml(order.trackingId)}</strong>` : ""}
  </p>`;
}

/* -------------------------------------------------------------------------
 * Customer templates
 * ---------------------------------------------------------------------- */

type OrderTemplateDef = {
  subject: (o: Order, ctx: EmailContext) => string;
  heading: (o: Order, ctx: EmailContext) => string;
  body: (o: Order, ctx: EmailContext, extra: EmailExtra) => string;
};

export type EmailExtra = {
  refundAmountInPaise?: number;
  failureReason?: string;
};

const templateDefs = {
  order_confirmed: {
    subject: (o) => `Order confirmed — ${o.orderNumber}`,
    heading: (o) =>
      `Thanks ${escapeHtml(o.customerName.split(" ")[0])}, your order is confirmed`,
    body: (o, ctx) =>
      para(
        o.paymentMethod === "cod"
          ? "We've received your order and it's being prepared. Keep the amount handy — you can pay by cash or UPI on delivery."
          : "Your payment is confirmed and your order is being prepared.",
      ) + orderSummary(o, ctx),
  },
  payment_received: {
    subject: (o) => `Payment received for ${o.orderNumber}`,
    heading: () => "Payment received — thank you",
    body: (o, ctx) =>
      para(
        `We've received your payment of <strong>${formatINR(o.totalInPaise)}</strong>. Your Beevo Go is now confirmed and will be dispatched within ${escapeHtml(ctx.settings.dispatchWindow)}.`,
      ) + orderSummary(o, ctx),
  },
  payment_failed: {
    subject: (o) => `Payment could not be completed — ${o.orderNumber}`,
    heading: () => "Your payment didn't go through",
    body: (o, ctx) =>
      para(
        "We couldn't confirm your online payment, so the order hasn't been placed yet. If any amount was deducted, your bank will reverse it automatically — no action needed.",
      ) +
      para(
        "You can try again from the checkout page, or place the same order with Cash on Delivery.",
      ) +
      orderSummary(o, ctx),
  },
  processing: {
    subject: (o) => `${o.orderNumber} is being packed`,
    heading: () => "Your order is being packed",
    body: (o, ctx) =>
      para(
        "Good news — your Beevo Go is being packed at our facility. We'll email you as soon as it's on its way.",
      ) + orderSummary(o, ctx),
  },
  shipped: {
    subject: (o) => `${o.orderNumber} has shipped`,
    heading: () => "Your order is on its way",
    body: (o, ctx) =>
      para("Your Beevo Go has been handed to our courier partner.") +
      courierBlock(o) +
      orderSummary(o, ctx),
  },
  out_for_delivery: {
    subject: (o) => `${o.orderNumber} is out for delivery`,
    heading: () => "Arriving at your door today",
    body: (o, ctx) =>
      para(
        o.paymentMethod === "cod"
          ? `Your order is out for delivery today. Please keep <strong>${formatINR(o.totalInPaise)}</strong> ready (cash or UPI).`
          : "Your order is out for delivery and should reach you today.",
      ) +
      courierBlock(o) +
      orderSummary(o, ctx),
  },
  delivered: {
    subject: (o) => `${o.orderNumber} delivered`,
    heading: () => "Delivered — happy printing!",
    body: (o, ctx) =>
      para(
        `Your Beevo Go has been delivered. If anything isn't right, you can request a replacement within ${ctx.settings.replacementWindowDays} days of delivery — just write to us.`,
      ) + orderSummary(o, ctx),
  },
  cancelled: {
    subject: (o) => `${o.orderNumber} cancelled`,
    heading: () => "Your order has been cancelled",
    body: (o, ctx) =>
      para(
        o.paymentStatus === "paid"
          ? `Your order has been cancelled. Since it was paid online, a refund of <strong>${formatINR(o.totalInPaise)}</strong> will be processed to the original payment method within 5–7 business days.`
          : "Your order has been cancelled. No payment was collected, so there's nothing more to do.",
      ) + orderSummary(o, ctx),
  },
  refunded: {
    subject: (o) => `Refund issued for ${o.orderNumber}`,
    heading: () => "Your refund is on its way",
    body: (o, ctx, extra) =>
      para(
        `We've issued a refund of <strong>${formatINR(extra.refundAmountInPaise ?? o.refundedInPaise ?? o.totalInPaise)}</strong> for order ${escapeHtml(o.orderNumber)}. It should reflect in the original payment method within 5–7 business days, depending on your bank.`,
      ) + orderSummary(o, ctx),
  },
} satisfies Record<string, OrderTemplateDef>;

export type EmailTemplateKey = keyof typeof templateDefs;

export const ORDER_TEMPLATE_KEYS = Object.keys(templateDefs) as EmailTemplateKey[];

/** Map order statuses to the customer-facing email for that transition. */
export function templateForStatus(
  order: Order,
  status: string,
): EmailTemplateKey | null {
  switch (status) {
    case "confirmed":
      return order.paymentMethod === "cod" ? "order_confirmed" : "payment_received";
    case "processing":
      return "processing";
    case "shipped":
      return "shipped";
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    default:
      return null;
  }
}

export function renderOrderEmail(
  order: Order,
  template: EmailTemplateKey,
  ctx: EmailContext,
  extra: EmailExtra = {},
): { subject: string; html: string } {
  const def: OrderTemplateDef = templateDefs[template];
  const statusLine = STATUS_META[order.status]?.label ?? "";
  const subject = def.subject(order, ctx);
  return {
    subject,
    html: shell({
      preheader: `${subject} — ${statusLine}`,
      heading: def.heading(order, ctx),
      body: def.body(order, ctx, extra),
      ctaUrl: trackUrl(order, ctx),
      ctaLabel: "Track your order",
      ctx,
    }),
  };
}

/* -------------------------------------------------------------------------
 * Internal / operational templates (sent to the store, not to customers)
 * ---------------------------------------------------------------------- */

export type AdminTemplateKey =
  | "admin_new_order"
  | "admin_contact_message"
  | "admin_low_stock";

export function renderAdminNewOrder(
  order: Order,
  ctx: EmailContext,
): { subject: string; html: string } {
  const subject = `New ${order.paymentMethod === "cod" ? "COD" : "prepaid"} order ${order.orderNumber} — ${formatINR(order.totalInPaise)}`;
  return {
    subject,
    html: shell({
      preheader: subject,
      heading: "New order received",
      body:
        para(
          `${escapeHtml(order.productName)} × ${order.quantity} — <strong>${formatINR(order.totalInPaise)}</strong> (${order.paymentMethod === "cod" ? "Cash on Delivery" : "paid online"}).`,
        ) +
        para(
          `Ship to ${escapeHtml(order.city)}, ${escapeHtml(order.state)} — ${escapeHtml(order.pincode)}.`,
        ),
      ctaUrl: `${ctx.siteUrl}/admin/orders`,
      ctaLabel: "Open admin",
      ctx,
    }),
  };
}

export function renderAdminContactMessage(
  input: {
    name: string;
    email: string;
    phone: string | null;
    topic: string;
    orderNumber: string | null;
    message: string;
  },
  ctx: EmailContext,
): { subject: string; html: string } {
  const subject = `New contact message — ${input.topic}${input.orderNumber ? ` (${input.orderNumber})` : ""}`;
  return {
    subject,
    html: shell({
      preheader: subject,
      heading: "New message from the contact form",
      body:
        para(
          `<strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(input.email)}&gt;${input.phone ? ` · +91 ${escapeHtml(input.phone)}` : ""}`,
        ) +
        (input.orderNumber
          ? para(`Order: <strong>${escapeHtml(input.orderNumber)}</strong>`)
          : "") +
        `<p style="margin:0 0 12px;padding:14px 16px;background:#F7F3EB;border-radius:10px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(input.message)}</p>`,
      ctaUrl: `${ctx.siteUrl}/admin/messages`,
      ctaLabel: "Open messages",
      ctx,
    }),
  };
}

export function renderAdminLowStock(
  input: { productName: string; quantity: number; threshold: number },
  ctx: EmailContext,
): { subject: string; html: string } {
  const subject =
    input.quantity <= 0
      ? `Out of stock — ${input.productName}`
      : `Low stock — ${input.productName} (${input.quantity} left)`;
  return {
    subject,
    html: shell({
      preheader: subject,
      heading: input.quantity <= 0 ? "Out of stock" : "Low stock warning",
      body: para(
        `${escapeHtml(input.productName)} is down to <strong>${input.quantity}</strong> unit${input.quantity === 1 ? "" : "s"} (threshold ${input.threshold}). Restock from the inventory page to keep the storefront buyable.`,
      ),
      ctaUrl: `${ctx.siteUrl}/admin/inventory`,
      ctaLabel: "Open inventory",
      ctx,
    }),
  };
}
