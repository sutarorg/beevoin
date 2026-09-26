import type { OrderStatus, PaymentStatus } from "@/db/schema";

/**
 * Pure order-status metadata and transition rules.
 *
 * No database or server-only imports — this module is safe in client bundles
 * and is the SAME rule set the server enforces in `transitionOrderStatus()`.
 * UI restrictions are a convenience; the server is the authority.
 */

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "payment_pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; blurb: string; step: number }
> = {
  pending: { label: "Pending", blurb: "Awaiting payment confirmation", step: 0 },
  payment_pending: {
    label: "Payment pending",
    blurb: "Waiting for the online payment to complete",
    step: 0,
  },
  confirmed: { label: "Confirmed", blurb: "Your order is confirmed", step: 1 },
  processing: {
    label: "Processing",
    blurb: "Being packed at our facility",
    step: 2,
  },
  shipped: { label: "Shipped", blurb: "Handed over to the courier", step: 3 },
  out_for_delivery: {
    label: "Out for delivery",
    blurb: "Arriving at your doorstep today",
    step: 4,
  },
  delivered: { label: "Delivered", blurb: "Enjoy your Beevo Go!", step: 5 },
  cancelled: { label: "Cancelled", blurb: "This order was cancelled", step: -1 },
  refunded: { label: "Refunded", blurb: "Your refund has been issued", step: -1 },
};

/** Sequential steps rendered as the customer-facing progress timeline. */
export const TIMELINE_STEPS: OrderStatus[] = [
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

/**
 * The order lifecycle. Anything not listed is rejected server-side —
 * `delivered → processing` is not a workflow, it is a data-integrity bug.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["payment_pending", "confirmed", "cancelled"],
  payment_pending: ["confirmed", "cancelled", "pending"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "shipped"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses an admin may choose from, given the current status. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

/** Terminal states — no further movement. */
export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorised",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

/**
 * `refunded` is only reachable once money actually moved. Enforced again in
 * the refund service, which is the only place that may set it.
 */
export function refundEligible(order: {
  paymentStatus: PaymentStatus;
  paymentMethod: string;
}): boolean {
  return (
    order.paymentMethod === "online" &&
    (order.paymentStatus === "paid" ||
      order.paymentStatus === "partially_refunded")
  );
}
