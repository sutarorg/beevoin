import type { OrderStatus } from "@/db/schema";

/**
 * Pure order-status metadata — no database imports, safe for client bundles.
 */

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
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
  confirmed: { label: "Confirmed", blurb: "Your order is confirmed", step: 1 },
  processing: { label: "Processing", blurb: "Being packed at our facility", step: 2 },
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
