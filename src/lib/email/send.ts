import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs, type Order } from "@/db/schema";
import { email } from "../config";
import {
  renderOrderEmail,
  templateForStatus,
  type EmailTemplateKey,
} from "./templates";

/**
 * Transactional email pipeline (outbox pattern).
 *
 * Every email is first recorded in `email_logs`. If a provider is configured
 * (Resend via RESEND_API_KEY) it is delivered immediately and the log is
 * marked `sent`; otherwise it stays `skipped` so an operator can see exactly
 * what would have been sent. Email failures never break order flows.
 */

async function deliverWithResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: email.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function sendOrderEmail(
  order: Order,
  template: EmailTemplateKey,
): Promise<void> {
  try {
    const { subject, html } = renderOrderEmail(order, template);

    const [log] = await db
      .insert(emailLogs)
      .values({
        orderId: order.id,
        template,
        toEmail: order.email,
        subject,
        html,
        delivery: process.env.RESEND_API_KEY ? "queued" : "skipped",
      })
      .returning({ id: emailLogs.id });

    if (process.env.RESEND_API_KEY) {
      const result = await deliverWithResend({
        to: order.email,
        subject,
        html,
      });
      if (result.ok) {
        await db
          .update(emailLogs)
          .set({ delivery: "sent" })
          .where(eq(emailLogs.id, log.id));
      } else {
        await db
          .update(emailLogs)
          .set({ delivery: "failed", error: result.error ?? null })
          .where(eq(emailLogs.id, log.id));
        console.error(
          JSON.stringify({ event: "email_failed", template, error: result.error }),
        );
      }
    }
  } catch (err) {
    // Swallow — emails are best-effort and must never fail an order request.
    console.error(
      JSON.stringify({
        event: "email_pipeline_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/** Send the email matching an order-status transition (if any). */
export async function sendStatusEmail(order: Order): Promise<void> {
  const template = templateForStatus(order, order.status);
  if (template) await sendOrderEmail(order, template);
}
