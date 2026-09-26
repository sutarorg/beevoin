import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailLogs, orders, type EmailLog, type Order } from "@/db/schema";
import { emailConfig, emailFrom, site } from "../config";
import { logError, logEvent } from "../logger";
import { getStoreSettings } from "../settings";
import {
  renderAdminContactMessage,
  renderAdminLowStock,
  renderAdminNewOrder,
  renderOrderEmail,
  templateForStatus,
  type EmailContext,
  type EmailExtra,
  type EmailTemplateKey,
} from "./templates";

/**
 * Transactional email pipeline (outbox pattern) on top of Resend.
 *
 * Guarantees:
 *  - **Idempotent**: every send carries a deterministic key stored in a
 *    unique column, so repeated callbacks/webhooks/admin clicks send once.
 *  - **Non-fatal**: a Resend outage never rolls back an order or a payment —
 *    the failure is logged and can be retried from /admin/emails.
 *  - **Low PII**: we store the recipient, subject and the minimal payload
 *    needed to re-render, not the rendered customer HTML.
 */

let client: Resend | null = null;
function resend(): Resend | null {
  if (!emailConfig.resendConfigured) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

async function emailContext(): Promise<EmailContext> {
  return { settings: await getStoreSettings(), siteUrl: site.url };
}

type DeliverResult = { ok: boolean; messageId?: string; error?: string };

async function deliver(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<DeliverResult> {
  const provider = resend();
  if (!provider) return { ok: false, error: "Resend is not configured" };
  try {
    const { data, error } = await provider.emails.send({
      from: emailFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    });
    if (error) return { ok: false, error: `${error.name}: ${error.message}`.slice(0, 300) };
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 300) : "Network error",
    };
  }
}

type QueueInput = {
  orderId: string | null;
  template: string;
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

/**
 * Reserves the send in `email_logs`. Returns null when an email with the same
 * idempotency key already exists — that's the duplicate-suppression point.
 */
async function reserve(input: QueueInput): Promise<EmailLog | null> {
  const [row] = await db
    .insert(emailLogs)
    .values({
      orderId: input.orderId,
      template: input.template,
      toEmail: input.to,
      subject: input.subject,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      delivery: emailConfig.resendConfigured ? "queued" : "skipped",
    })
    .onConflictDoNothing({ target: emailLogs.idempotencyKey })
    .returning();
  return row ?? null;
}

async function send(input: QueueInput): Promise<{ sent: boolean; duplicate: boolean }> {
  const reserved = await reserve(input);
  if (!reserved) {
    logEvent("email_skipped", { template: input.template, reason: "duplicate" });
    return { sent: false, duplicate: true };
  }

  if (!emailConfig.resendConfigured) {
    logEvent("email_skipped", {
      template: input.template,
      reason: "resend_not_configured",
    });
    return { sent: false, duplicate: false };
  }

  const result = await deliver({
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  await db
    .update(emailLogs)
    .set({
      delivery: result.ok ? "sent" : "failed",
      providerMessageId: result.messageId ?? null,
      error: result.ok ? null : (result.error ?? "Unknown error"),
      attempts: 1,
      lastAttemptAt: new Date(),
    })
    .where(eq(emailLogs.id, reserved.id));

  if (result.ok) {
    logEvent("email_sent", { template: input.template });
  } else {
    logEvent("email_failed", { template: input.template });
  }
  return { sent: result.ok, duplicate: false };
}

/* -------------------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------------- */

export async function sendOrderEmail(
  order: Order,
  template: EmailTemplateKey,
  options: { idempotencyKey?: string; extra?: EmailExtra } = {},
): Promise<{ sent: boolean; duplicate: boolean }> {
  try {
    const ctx = await emailContext();
    const { subject, html } = renderOrderEmail(
      order,
      template,
      ctx,
      options.extra ?? {},
    );
    return await send({
      orderId: order.id,
      template,
      to: order.email,
      subject,
      html,
      idempotencyKey: options.idempotencyKey ?? `${order.id}:${template}`,
      payload: { orderId: order.id, template, ...(options.extra ?? {}) },
    });
  } catch (err) {
    // Emails are best-effort: never fail the caller's business transaction.
    logError("email_failed", err, { template });
    return { sent: false, duplicate: false };
  }
}

/** Sends the customer email matching an order-status transition, if any. */
export async function sendStatusEmail(
  order: Order,
  options: { idempotencyKey?: string; extra?: EmailExtra } = {},
): Promise<void> {
  const template = templateForStatus(order, order.status);
  if (!template) return;
  await sendOrderEmail(order, template, options);
}

export async function sendAdminNewOrderEmail(order: Order): Promise<void> {
  const to = (await getStoreSettings()).adminNotificationEmail;
  if (!to) return;
  try {
    const ctx = await emailContext();
    const { subject, html } = renderAdminNewOrder(order, ctx);
    await send({
      orderId: order.id,
      template: "admin_new_order",
      to,
      subject,
      html,
      idempotencyKey: `${order.id}:admin_new_order`,
      payload: { orderId: order.id, template: "admin_new_order" },
    });
  } catch (err) {
    logError("email_failed", err, { template: "admin_new_order" });
  }
}

export async function sendAdminContactEmail(input: {
  messageId: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  orderNumber: string | null;
  message: string;
}): Promise<void> {
  const to = (await getStoreSettings()).adminNotificationEmail;
  if (!to) return;
  try {
    const ctx = await emailContext();
    const { subject, html } = renderAdminContactMessage(input, ctx);
    await send({
      orderId: null,
      template: "admin_contact_message",
      to,
      subject,
      html,
      idempotencyKey: `${input.messageId}:admin_contact_message`,
      payload: { contactMessageId: input.messageId, template: "admin_contact_message" },
    });
  } catch (err) {
    logError("email_failed", err, { template: "admin_contact_message" });
  }
}

export async function sendLowStockEmail(input: {
  productId: string;
  productName: string;
  quantity: number;
  threshold: number;
  /** Keeps one alert per stock level instead of one per order. */
  stateKey: string;
}): Promise<void> {
  const to = (await getStoreSettings()).adminNotificationEmail;
  if (!to) return;
  try {
    const ctx = await emailContext();
    const { subject, html } = renderAdminLowStock(input, ctx);
    await send({
      orderId: null,
      template: "admin_low_stock",
      to,
      subject,
      html,
      idempotencyKey: `${input.productId}:low_stock:${input.stateKey}`,
      payload: {
        productId: input.productId,
        template: "admin_low_stock",
        quantity: input.quantity,
      },
    });
  } catch (err) {
    logError("email_failed", err, { template: "admin_low_stock" });
  }
}

/**
 * Re-sends a logged email. The body is re-rendered from the stored payload,
 * so no customer HTML has to be warehoused for retries to work.
 */
export async function retryEmail(
  logId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [log] = await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.id, logId))
    .limit(1);
  if (!log) return { ok: false, error: "Email not found." };
  if (!emailConfig.resendConfigured) {
    return { ok: false, error: "Resend is not configured on this deployment." };
  }

  let subject = log.subject;
  let html = log.html ?? "";

  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const ctx = await emailContext();

  if (typeof payload.orderId === "string") {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, payload.orderId))
      .limit(1);
    if (order) {
      if (log.template === "admin_new_order") {
        ({ subject, html } = renderAdminNewOrder(order, ctx));
      } else {
        ({ subject, html } = renderOrderEmail(
          order,
          log.template as EmailTemplateKey,
          ctx,
          {
            refundAmountInPaise:
              typeof payload.refundAmountInPaise === "number"
                ? payload.refundAmountInPaise
                : undefined,
          },
        ));
      }
    }
  }

  if (!html) {
    return {
      ok: false,
      error: "This email can no longer be re-rendered (no stored payload).",
    };
  }

  const result = await deliver({ to: log.toEmail, subject, html });
  await db
    .update(emailLogs)
    .set({
      delivery: result.ok ? "sent" : "failed",
      providerMessageId: result.messageId ?? log.providerMessageId ?? null,
      error: result.ok ? null : (result.error ?? "Unknown error"),
      attempts: (log.attempts ?? 0) + 1,
      lastAttemptAt: new Date(),
      subject,
    })
    .where(eq(emailLogs.id, log.id));

  if (result.ok) logEvent("email_sent", { template: log.template, retry: true });
  else logEvent("email_failed", { template: log.template, retry: true });

  return { ok: result.ok, error: result.error };
}
