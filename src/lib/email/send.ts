import "server-only";

import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailLogs, type EmailLog, type Order } from "@/db/schema";
import { email as emailConfig, emailSender } from "../config";
import { logEvent } from "../http";
import {
  renderAdminEmail,
  renderOrderEmail,
  templateForStatus,
  type AdminTemplateKey,
  type EmailTemplateKey,
  type OrderEmailContext,
} from "./templates";

/**
 * Transactional email pipeline (outbox pattern) on top of Resend.
 *
 * Guarantees:
 *   • IDEMPOTENT — `email_logs.event_key` is UNIQUE. A duplicate key means the
 *     email was already queued (webhook replay, double-clicked button, retried
 *     request) and the send is skipped.
 *   • NON-FATAL — a Resend outage records `delivery = 'failed'` and returns;
 *     it never rolls back an order or a payment.
 *   • MINIMAL PII — rendered HTML is not persisted. Retries re-render from the
 *     order, so nothing about the customer is duplicated into the log table.
 */

let resendClient: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

type DeliveryResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

async function deliver(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<DeliveryResult> {
  const client = resend();
  if (!client) return { ok: false, error: "RESEND_API_KEY is not configured" };

  try {
    const { data, error } = await client.emails.send({
      from: emailSender(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });
    if (error) {
      return { ok: false, error: `${error.name}: ${error.message}`.slice(0, 300) };
    }
    return { ok: true, messageId: data?.id ?? null };
  } catch (err) {
    return {
      ok: false,
      error: (err instanceof Error ? err.message : "Network error").slice(0, 300),
    };
  }
}

/**
 * Deterministic idempotency key.
 * `<orderId>:<template>:<stateVersion>` — the state version is whatever makes
 * the event unique (the new status, the payment id, the refund id).
 */
export function emailEventKey(
  orderId: string,
  template: string,
  stateVersion: string,
): string {
  return `${orderId}:${template}:${stateVersion}`.slice(0, 160);
}

function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("email_logs_event_key_idx") ||
    message.includes("duplicate key value")
  );
}

/**
 * Queue + deliver one transactional order email.
 * Returns `"sent" | "failed" | "skipped" | "duplicate"`.
 */
export async function sendOrderEmail(
  order: Order,
  template: EmailTemplateKey,
  options: { eventKey?: string; context?: OrderEmailContext } = {},
): Promise<"sent" | "failed" | "skipped" | "duplicate"> {
  const eventKey =
    options.eventKey ?? emailEventKey(order.id, template, order.status);

  let logId: string;
  try {
    const { subject } = renderOrderEmail(order, template, options.context);
    const [row] = await db
      .insert(emailLogs)
      .values({
        orderId: order.id,
        eventKey,
        template,
        toEmail: order.email,
        subject,
        html: null,
        delivery: emailConfig.resendConfigured ? "queued" : "skipped",
      })
      .returning({ id: emailLogs.id });
    logId = row.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      logEvent("email_duplicate_suppressed", { template });
      return "duplicate";
    }
    logEvent("email_pipeline_error", {
      template,
      error: err instanceof Error ? err.message : "unknown",
    });
    return "failed";
  }

  if (!emailConfig.resendConfigured) {
    logEvent("email_skipped", { template, reason: "resend_not_configured" });
    return "skipped";
  }

  return attemptDelivery(logId, order, template, options.context);
}

async function attemptDelivery(
  logId: string,
  order: Order,
  template: EmailTemplateKey,
  context?: OrderEmailContext,
): Promise<"sent" | "failed"> {
  const { subject, html } = renderOrderEmail(order, template, context);
  const result = await deliver({ to: order.email, subject, html });

  if (result.ok) {
    await db
      .update(emailLogs)
      .set({
        delivery: "sent",
        providerMessageId: result.messageId,
        error: null,
        attempts: 1,
        lastAttemptAt: new Date(),
      })
      .where(eq(emailLogs.id, logId));
    logEvent("email_sent", { template });
    return "sent";
  }

  await db
    .update(emailLogs)
    .set({
      delivery: "failed",
      error: result.error,
      attempts: 1,
      lastAttemptAt: new Date(),
    })
    .where(eq(emailLogs.id, logId));
  logEvent("email_failed", { template, error: result.error });
  return "failed";
}

/** Sends the customer email matching an order-status transition (if any). */
export async function sendStatusEmail(
  order: Order,
  options: { eventKey?: string } = {},
): Promise<void> {
  const template = templateForStatus(order, order.status);
  if (!template) return;
  await sendOrderEmail(order, template, {
    eventKey:
      options.eventKey ?? emailEventKey(order.id, template, order.status),
  });
}

/**
 * Re-send a previously logged order email. Re-renders from the order so no
 * stale HTML (and no stored PII) is involved.
 */
export async function retryEmail(
  logId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [log] = await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.id, logId))
    .limit(1);
  if (!log) return { ok: false, error: "Email log not found." };
  if (!log.orderId) {
    return {
      ok: false,
      error: "Only order emails can be retried; re-trigger the source event instead.",
    };
  }
  if (!emailConfig.resendConfigured) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const { orders } = await import("@/db/schema");
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, log.orderId))
    .limit(1);
  if (!order) return { ok: false, error: "Order no longer exists." };

  const { subject, html } = renderOrderEmail(
    order,
    log.template as EmailTemplateKey,
  );
  const result = await deliver({ to: log.toEmail, subject, html });

  await db
    .update(emailLogs)
    .set({
      delivery: result.ok ? "sent" : "failed",
      providerMessageId: result.ok ? result.messageId : log.providerMessageId,
      error: result.ok ? null : result.error,
      attempts: log.attempts + 1,
      lastAttemptAt: new Date(),
    })
    .where(eq(emailLogs.id, logId));

  logEvent(result.ok ? "email_sent" : "email_failed", {
    template: log.template,
    retry: true,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Internal operator notification (contact form, low stock, payment failure).
 * Never sent to customers, never promotional.
 */
export async function sendAdminNotification(input: {
  template: AdminTemplateKey;
  to: string;
  eventKey: string;
  data: Record<string, string>;
  replyTo?: string;
  orderId?: string | null;
}): Promise<"sent" | "failed" | "skipped" | "duplicate"> {
  if (!input.to) return "skipped";

  const { subject, html } = renderAdminEmail(input.template, input.data);

  let logId: string;
  try {
    const [row] = await db
      .insert(emailLogs)
      .values({
        orderId: input.orderId ?? null,
        eventKey: input.eventKey.slice(0, 160),
        template: input.template,
        toEmail: input.to,
        subject,
        html: null,
        delivery: emailConfig.resendConfigured ? "queued" : "skipped",
      })
      .returning({ id: emailLogs.id });
    logId = row.id;
  } catch (err) {
    if (isUniqueViolation(err)) return "duplicate";
    return "failed";
  }

  if (!emailConfig.resendConfigured) return "skipped";

  const result = await deliver({
    to: input.to,
    subject,
    html,
    replyTo: input.replyTo,
  });

  await db
    .update(emailLogs)
    .set({
      delivery: result.ok ? "sent" : "failed",
      providerMessageId: result.ok ? result.messageId : null,
      error: result.ok ? null : result.error,
      attempts: 1,
      lastAttemptAt: new Date(),
    })
    .where(eq(emailLogs.id, logId));

  logEvent(result.ok ? "email_sent" : "email_failed", {
    template: input.template,
  });
  return result.ok ? "sent" : "failed";
}

export type { EmailLog };
