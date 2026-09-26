import type { OrderStatus } from "@/db/schema";

/**
 * Pure order-status metadata and the transition machine.
 * No database imports — safe for client bundles.
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
 * Allowed order-status transitions. Enforced on the server for every change,
 * whether it comes from an admin, a payment callback or a webhook.
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["payment_pending", "confirmed", "cancelled"],
  payment_pending: ["confirmed", "cancelled", "pending"],
  confirmed: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["out_for_delivery", "delivered", "cancelled", "refunded"],
  out_for_delivery: ["delivered", "shipped", "cancelled", "refunded"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses an admin may pick from in the UI (server re-checks anyway). */
export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return STATUS_TRANSITIONS[from] ?? [];
}

/** Orders whose reserved stock is still held by the customer. */
export const STOCK_HOLDING_STATUSES: OrderStatus[] = [
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export function isOpenOrder(status: OrderStatus): boolean {
  return status !== "cancelled" && status !== "refunded" && status !== "delivered";
}
