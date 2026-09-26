import type { Order } from "@/db/schema";
import { site, policies } from "../config";
import { escapeHtml, formatINR, formatDateTime } from "../format";
import { STATUS_META } from "../order-status";

/**
 * Responsive, table-based transactional email templates with inline CSS
 * (required for email-client compatibility). Never promotional — each email
 * is triggered by a real order event.
 */

const ACCENT = "#E4520E";
const INK = "#1D1912";

function trackUrl(order: Order): string {
  return `${site.url}/track?order=${encodeURIComponent(order.orderNumber)}&key=${order.lookupSecret}`;
}

function shell(opts: {
  preheader: string;
  heading: string;
  body: string;
  trackUrl: string;
}): string {
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
  <tr><td style="padding:24px 28px 8px;">
    <a href="${opts.trackUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:13px 26px;border-radius:999px;">Track your order</a>
  </td></tr>
  <tr><td style="padding:28px;">
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;color:#8A8172;line-height:1.6;">
      Ordered from ${escapeHtml(site.name)} — ${escapeHtml(site.tagline)}<br>
      Questions? Write to <a href="mailto:${site.supportEmail}" style="color:${ACCENT};text-decoration:none;">${site.supportEmail}</a> (${site.supportHours}).
    </p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#B0A793;">
      This is a transactional email about your order. Please don't reply directly to this message.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function orderSummary(order: Order): string {
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
<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#8A8172;">Estimated delivery: ${policies.deliveryEstimate} after dispatch.</p>`;
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

const templateDefs = {
  order_confirmed: {
    subject: (o: Order) => `Order confirmed — ${o.orderNumber}`,
    heading: (o: Order) =>
      `Thanks ${escapeHtml(o.customerName.split(" ")[0])}, your order is confirmed`,
    body: (o: Order) =>
      para(
        o.paymentMethod === "cod"
          ? "We've received your order and it's being prepared. Keep the amount handy — you can pay by cash or UPI on delivery."
          : "Your payment is confirmed and your order is being prepared.",
      ) + orderSummary(o),
  },
  payment_received: {
    subject: (o: Order) => `Payment received for ${o.orderNumber}`,
    heading: () => "Payment received — thank you",
    body: (o: Order) =>
      para(
        `We've received your payment of <strong>${formatINR(o.totalInPaise)}</strong>. Your Beevo Go is now confirmed and will be dispatched within ${policies.dispatchWindow}.`,
      ) + orderSummary(o),
  },
  processing: {
    subject: (o: Order) => `${o.orderNumber} is being packed`,
    heading: () => "Your order is being packed",
    body: (o: Order) =>
      para(
        "Good news — your Beevo Go is being packed at our facility. We'll email you as soon as it's on its way.",
      ) + orderSummary(o),
  },
  shipped: {
    subject: (o: Order) => `${o.orderNumber} has shipped`,
    heading: () => "Your order is on its way",
    body: (o: Order) =>
      para("Your Beevo Go has been handed to our courier partner.") +
      courierBlock(o) +
      orderSummary(o),
  },
  out_for_delivery: {
    subject: (o: Order) => `${o.orderNumber} is out for delivery`,
    heading: () => "Arriving at your door today",
    body: (o: Order) =>
      para(
        o.paymentMethod === "cod"
          ? `Your order is out for delivery today. Please keep <strong>${formatINR(o.totalInPaise)}</strong> ready (cash or UPI).`
          : "Your order is out for delivery and should reach you today.",
      ) + courierBlock(o) + orderSummary(o),
  },
  delivered: {
    subject: (o: Order) => `${o.orderNumber} delivered`,
    heading: () => "Delivered — happy printing!",
    body: (o: Order) =>
      para(
        "Your Beevo Go has been delivered. If anything isn't right, you can request a replacement within " +
          policies.replacementWindowDays +
          " days of delivery — just write to us.",
      ) + orderSummary(o),
  },
  cancelled: {
    subject: (o: Order) => `${o.orderNumber} cancelled`,
    heading: () => "Your order has been cancelled",
    body: (o: Order) =>
      para(
        o.paymentStatus === "paid"
          ? `Your order has been cancelled. Since it was paid online, a refund of <strong>${formatINR(o.totalInPaise)}</strong> will be processed to the original payment method within 5–7 business days.`
          : "Your order has been cancelled. No payment was collected, so there's nothing more to do.",
      ) + orderSummary(o),
  },
  refunded: {
    subject: (o: Order) => `Refund issued for ${o.orderNumber}`,
    heading: () => "Your refund is on its way",
    body: (o: Order, ctx?: OrderEmailContext) => {
      const amount = ctx?.refundAmountInPaise ?? o.totalInPaise;
      const partial = amount < o.totalInPaise;
      return (
        para(
          `We've issued a ${partial ? "partial " : ""}refund of <strong>${formatINR(amount)}</strong> for order ${escapeHtml(o.orderNumber)}. It should reflect in the original payment method within 5–7 business days, depending on your bank.`,
        ) + orderSummary(o)
      );
    },
  },
  payment_failed: {
    subject: (o: Order) => `Payment could not be completed — ${o.orderNumber}`,
    heading: () => "Your payment didn't go through",
    body: (o: Order) =>
      para(
        "We couldn't confirm your online payment, so your order has not been charged. If your bank shows a deduction it will be reversed automatically, usually within 5–7 business days.",
      ) +
      para(
        "You can try again from the tracking link below, or write to us and we'll place the order as Cash on Delivery instead.",
      ) +
      orderSummary(o),
  },
} as const;

/** Extra, event-specific values a template may need (e.g. partial refunds). */
export type OrderEmailContext = {
  refundAmountInPaise?: number;
};

export type EmailTemplateKey = keyof typeof templateDefs;

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
  context?: OrderEmailContext,
): { subject: string; html: string } {
  const def = templateDefs[template];
  const statusLine = STATUS_META[order.status]?.label ?? "";
  return {
    subject: def.subject(order),
    html: shell({
      preheader: `${def.subject(order)} — ${statusLine}`,
      heading: def.heading(order),
      body: (def.body as (o: Order, ctx?: OrderEmailContext) => string)(
        order,
        context,
      ),
      trackUrl: trackUrl(order),
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Internal operator notifications. Plain, minimal, never promotional
 * and never sent to a customer.
 * ------------------------------------------------------------------ */

const adminTemplateDefs = {
  contact_notification: {
    subject: (d: Record<string, string>) =>
      `Beevo contact — ${d.topic ?? "general"}${d.orderNumber ? ` (${d.orderNumber})` : ""}`,
    heading: () => "New contact-form message",
    rows: (d: Record<string, string>) => [
      ["From", `${d.name ?? ""} <${d.email ?? ""}>`],
      ["Phone", d.phone || "not provided"],
      ["Topic", d.topic ?? "general"],
      ["Order", d.orderNumber || "—"],
      ["Message", d.message ?? ""],
    ],
  },
  low_inventory_alert: {
    subject: (d: Record<string, string>) =>
      `Low stock — ${d.sku ?? ""} has ${d.quantity ?? "0"} left`,
    heading: () => "Inventory is running low",
    rows: (d: Record<string, string>) => [
      ["Product", d.productName ?? ""],
      ["SKU", d.sku ?? ""],
      ["Units remaining", d.quantity ?? "0"],
      ["Low-stock threshold", d.threshold ?? ""],
    ],
  },
  payment_failure_alert: {
    subject: (d: Record<string, string>) =>
      `Payment failed — ${d.orderNumber ?? ""}`,
    heading: () => "An online payment failed",
    rows: (d: Record<string, string>) => [
      ["Order", d.orderNumber ?? ""],
      ["Amount", d.amount ?? ""],
      ["Reason", d.reason ?? "unknown"],
    ],
  },
} as const;

export type AdminTemplateKey = keyof typeof adminTemplateDefs;

export function renderAdminEmail(
  template: AdminTemplateKey,
  data: Record<string, string>,
): { subject: string; html: string } {
  const def = adminTemplateDefs[template];
  const rows = def
    .rows(data)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;font-family:Arial,sans-serif;font-size:13px;color:#8A8172;width:150px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;font-family:Arial,sans-serif;font-size:14px;color:${INK};white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const subject = def.subject(data);
  return {
    subject,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#F4EEE3;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #E8E0D0;">
  <tr><td style="background:${INK};padding:16px 24px;">
    <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#ffffff;">beevo<span style="color:${ACCENT};">.</span> <span style="font-family:Arial,sans-serif;font-size:12px;color:#ffffffaa;">operations</span></span>
  </td></tr>
  <tr><td style="padding:24px;">
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:20px;color:${INK};">${escapeHtml(def.heading())}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>
</table>
</body></html>`,
  };
}
