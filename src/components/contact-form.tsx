"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { contactSchema } from "@/lib/validations";
import { Card, Field, buttonClasses, inputClasses } from "./ui";

type Errors = Record<string, string | undefined>;

const TOPICS = [
  { value: "order", label: "About my order" },
  { value: "shipping", label: "Shipping & delivery" },
  { value: "returns", label: "Returns & refunds" },
  { value: "product", label: "Product question" },
  { value: "general", label: "Something else" },
] as const;

export function ContactForm() {
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "order" as string,
    orderNumber: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const set =
    (key: keyof typeof values) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setValues((p) => ({ ...p, [key]: e.target.value }));
      setErrors((p) => ({ ...p, [key]: undefined }));
    };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
        fieldErrors?: Errors;
        web3formsFallbackKey?: string;
      };
      if (!res.ok || !data.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // If Web3Forms can only accept browser-side submissions (free plan), the
      // validated API response hands us the key — complete delivery here.
      // Fire-and-forget: the durable record is already stored server-side.
      if (data.web3formsFallbackKey) {
        const parsed = contactSchema.parse(values);
        void fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            access_key: data.web3formsFallbackKey,
            from_name: "Beevo store contact form",
            subject: `Beevo contact — ${parsed.topic}${
              parsed.orderNumber ? ` (${parsed.orderNumber.toUpperCase()})` : ""
            }`,
            name: parsed.name,
            email: parsed.email,
            replyto: parsed.email,
            message: [
              `Topic: ${parsed.topic}`,
              parsed.orderNumber
                ? `Order ID: ${parsed.orderNumber.toUpperCase()}`
                : null,
              parsed.phone ? `Phone: +91 ${parsed.phone}` : null,
              "",
              parsed.message,
            ]
              .filter((line): line is string => line !== null)
              .join("\n"),
          }),
        }).catch(() => {
          // Silent — the server already has the message.
        });
      }

      setDone(data.message ?? "Message received — we'll be in touch soon.");
    } catch {
      setFormError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="rounded-full bg-leaf-soft p-4">
          <CheckCircle2 className="size-8 text-leaf" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-semibold text-ink">
          Message sent
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{done}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-7">
      <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name" error={errors.name}>
          <input
            id="c-name"
            value={values.name}
            onChange={set("name")}
            className={inputClasses(Boolean(errors.name))}
            autoComplete="name"
            placeholder="Ananya Iyer"
          />
        </Field>
        <Field label="Email" htmlFor="c-email" error={errors.email}>
          <input
            id="c-email"
            type="email"
            value={values.email}
            onChange={set("email")}
            className={inputClasses(Boolean(errors.email))}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Mobile number" htmlFor="c-phone" error={errors.phone} optional>
          <input
            id="c-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={values.phone}
            onChange={set("phone")}
            className={inputClasses(Boolean(errors.phone))}
            placeholder="98765 43210"
          />
        </Field>
        <Field label="Topic" htmlFor="c-topic">
          <select
            id="c-topic"
            value={values.topic}
            onChange={set("topic")}
            className={inputClasses(false)}
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Order ID"
            htmlFor="c-order"
            error={errors.orderNumber}
            optional
            hint="If it's about an order, this helps us find it fast"
          >
            <input
              id="c-order"
              value={values.orderNumber}
              onChange={set("orderNumber")}
              className={inputClasses(Boolean(errors.orderNumber))}
              placeholder="BV-260203-4821"
              spellCheck={false}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="How can we help?" htmlFor="c-message" error={errors.message}>
            <textarea
              id="c-message"
              value={values.message}
              onChange={set("message")}
              rows={5}
              maxLength={1500}
              className={`${inputClasses(Boolean(errors.message))} min-h-32 resize-y py-3`}
              placeholder="Tell us what's going on…"
            />
          </Field>
        </div>
        {formError ? (
          <p role="alert" className="rounded-xl bg-chili-soft p-3.5 text-sm font-bold text-chili sm:col-span-2">
            {formError}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}
          >
            {submitting ? (
              <Loader2 className="size-4.5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4.5" aria-hidden />
            )}
            {submitting ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
    </Card>
  );
}
