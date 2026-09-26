/**
 * Structured server logging.
 *
 * One JSON object per line so Vercel's log drain can parse it. The allow-list
 * below is the complete catalogue of operational events; anything else should
 * be added here deliberately.
 *
 * Never log: passwords, Supabase/Razorpay/Resend keys, database URLs, full
 * addresses, card data or raw webhook bodies.
 */

export const LOG_EVENTS = [
  "admin_login_success",
  "admin_login_failure",
  "admin_logout",
  "admin_action_denied",
  "order_created",
  "order_status_changed",
  "order_cancelled",
  "payment_order_created",
  "payment_verified",
  "payment_failed",
  "payment_captured",
  "payment_reconciled",
  "webhook_received",
  "webhook_duplicate",
  "webhook_invalid_signature",
  "webhook_error",
  "refund_created",
  "refund_failed",
  "inventory_adjusted",
  "inventory_insufficient",
  "email_sent",
  "email_failed",
  "email_skipped",
  "contact_message_received",
  "checkout_rejected",
  "checkout_error",
  "track_denied",
  "track_error",
  "rate_limited",
  "internal_error",
] as const;

export type LogEvent = (typeof LOG_EVENTS)[number];

type LogValue = string | number | boolean | null | undefined;

export function logEvent(
  event: LogEvent,
  data: Record<string, LogValue> = {},
): void {
  const line = JSON.stringify({
    event,
    ...data,
    at: new Date().toISOString(),
  });
  console.log(line);
}

export function logError(
  event: LogEvent,
  error: unknown,
  data: Record<string, LogValue> = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  const line = JSON.stringify({
    event,
    level: "error",
    error: message.slice(0, 300),
    ...data,
    at: new Date().toISOString(),
  });
  console.error(line);
}
