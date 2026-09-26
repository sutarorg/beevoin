"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2, PackageSearch, Search, Truck } from "lucide-react";
import { phoneRegex } from "@/lib/validations";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  OrderStatusBanner,
  OrderTimeline,
  buildStepStates,
} from "./order-timeline";
import { Badge, Card, Container, Field, Section, buttonClasses, inputClasses } from "./ui";
import type { OrderStatus } from "@/db/schema";

type TrackingSummary = {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  statusBlurb: string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  customer: string;
  item: { name: string; sku: string; quantity: number; unitPriceInPaise: number };
  shippingInPaise: number;
  totalInPaise: number;
  shipTo: { city: string; state: string; pincode: string };
  courierName: string | null;
  trackingId: string | null;
  events: { status: string; label: string; note: string | null; at: string }[];
};

export function TrackClient({
  initialOrder = "",
  initialKey = "",
}: {
  initialOrder?: string;
  initialKey?: string;
}) {
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [verifier, setVerifier] = useState("");
  const [errors, setErrors] = useState<{ orderNumber?: string; verifier?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingSummary | null>(null);
  const autoSearched = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    setFormError(null);
    setErrors({});

    const nextErrors: typeof errors = {};
    if (!/^BV-\d{6}-\d{4}$/i.test(orderNumber.trim())) {
      nextErrors.orderNumber = "Enter a valid order ID, e.g. BV-260203-4821";
    }
    const trimmed = verifier.trim();
    const isPhone = phoneRegex.test(trimmed);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const usingKey = Boolean(initialKey);
    if (!usingKey && !isPhone && !isEmail) {
      nextErrors.verifier =
        "Enter the 10-digit mobile number or email used while ordering";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim().toUpperCase(),
          phone: isPhone ? trimmed : "",
          email: isEmail ? trimmed.toLowerCase() : "",
          lookupSecret: initialKey,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        order?: TrackingSummary;
      };
      if (!res.ok || !data.ok || !data.order) {
        setResult(null);
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data.order);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch {
      setFormError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-lookup when arriving from a link that carries the lookup key.
  useEffect(() => {
    if (autoSearched.current) return;
    if (initialOrder && initialKey) {
      autoSearched.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch triggered by the deep link in the URL
      void lookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder, initialKey]);

  return (
    <Section className="pt-10 md:pt-14">
      <Container className="max-w-3xl">
        <div className="max-w-xl">
          <Badge tone="accent">
            <PackageSearch className="size-3.5" aria-hidden />
            Order tracking
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Where&apos;s my order?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Enter your order ID (from the confirmation email) plus the mobile
            number or email you ordered with — we use it only to make sure
            it&apos;s really you.
          </p>
        </div>

        <Card className="mt-7 p-6 md:p-7">
          <form onSubmit={lookup} noValidate className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Order ID" htmlFor="t-order" error={errors.orderNumber}>
              <input
                id="t-order"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  setErrors((p) => ({ ...p, orderNumber: undefined }));
                }}
                placeholder="BV-260203-4821"
                className={inputClasses(Boolean(errors.orderNumber))}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Mobile number or email"
              htmlFor="t-verifier"
              error={errors.verifier}
              hint={initialKey ? "Not needed — this link is already verified" : undefined}
            >
              <input
                id="t-verifier"
                value={verifier}
                onChange={(e) => {
                  setVerifier(e.target.value);
                  setErrors((p) => ({ ...p, verifier: undefined }));
                }}
                placeholder={initialKey ? "Verified link" : "98765 43210 or you@email.com"}
                disabled={Boolean(initialKey)}
                className={inputClasses(Boolean(errors.verifier))}
                autoComplete="off"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className={buttonClasses({ size: "md", className: "min-h-12" })}
            >
              {loading ? (
                <Loader2 className="size-4.5 animate-spin" aria-hidden />
              ) : (
                <Search className="size-4.5" aria-hidden />
              )}
              {loading ? "Checking…" : "Track"}
            </button>
          </form>
          {formError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-chili-soft p-3.5 text-sm font-bold text-chili"
            >
              {formError}
            </p>
          ) : null}
        </Card>

        {result ? (
          <div ref={resultRef} className="fade-up mt-6 space-y-5 scroll-mt-28">
            <OrderStatusBanner status={result.status} />

            <Card className="p-6 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-bold text-ink">
                    {result.orderNumber}
                  </p>
                  <p className="text-[13px] font-semibold text-ink-faint">
                    Placed {formatDateTime(result.placedAt)} · for {result.customer}
                  </p>
                </div>
                <Badge tone={result.status === "delivered" ? "leaf" : "accent"}>
                  <Truck className="size-3.5" aria-hidden />
                  {result.statusLabel}
                </Badge>
              </div>

              <div className="mt-6 grid gap-8 md:grid-cols-2">
                <div>
                  <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
                    Journey
                  </h2>
                  <div className="mt-4">
                    <OrderTimeline
                      steps={buildStepStates(result.status, result.events)}
                    />
                  </div>
                </div>
                <div className="space-y-5">
                  <div>
                    <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
                      Items
                    </h2>
                    <div className="mt-3 rounded-xl bg-cream/60 p-4 text-[14.5px]">
                      <p className="font-bold text-ink">
                        {result.item.name} × {result.item.quantity}
                      </p>
                      <dl className="mt-2.5 space-y-1.5 text-[13.5px]">
                        <div className="flex justify-between">
                          <dt className="font-semibold text-ink-soft">Amount</dt>
                          <dd className="font-mono font-bold tabular-nums">
                            {formatINR(result.item.unitPriceInPaise * result.item.quantity)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="font-semibold text-ink-soft">Shipping</dt>
                          <dd className="font-bold text-leaf">
                            {result.shippingInPaise === 0 ? "FREE" : formatINR(result.shippingInPaise)}
                          </dd>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-sandline pt-1.5">
                          <dt className="font-bold text-ink">Total</dt>
                          <dd className="font-mono font-bold tabular-nums">
                            {formatINR(result.totalInPaise)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
                      Delivery
                    </h2>
                    <div className="mt-3 space-y-2 text-[14px] font-semibold leading-relaxed text-ink-soft">
                      <p>
                        Shipping to {result.shipTo.city}, {result.shipTo.state} —{" "}
                        {result.shipTo.pincode}
                      </p>
                      {result.courierName || result.trackingId ? (
                        <p className="rounded-xl bg-cream/60 p-3">
                          {result.courierName ? (
                            <>
                              Courier:{" "}
                              <span className="font-bold text-ink">{result.courierName}</span>
                              <br />
                            </>
                          ) : null}
                          {result.trackingId ? (
                            <>
                              Tracking ID:{" "}
                              <span className="font-mono font-bold text-ink">
                                {result.trackingId}
                              </span>
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p>Courier details appear here once your order ships.</p>
                      )}
                      <p>
                        Payment:{" "}
                        <span className="font-bold text-ink">
                          {result.paymentMethod === "cod"
                            ? "Cash on Delivery"
                            : "Online"}
                        </span>{" "}
                        ·{" "}
                        <span
                          className={
                            result.paymentStatus === "paid"
                              ? "font-bold text-leaf"
                              : "font-bold text-haldi"
                          }
                        >
                          {result.paymentStatus === "paid"
                            ? "Paid"
                            : result.paymentMethod === "cod"
                              ? "To be collected on delivery"
                              : result.paymentStatus}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <p className="text-center text-sm font-semibold text-ink-soft">
              Something doesn&apos;t look right?{" "}
              <Link
                href="/contact"
                className="font-bold text-accent-deep underline-offset-4 hover:underline"
              >
                Contact support →
              </Link>
            </p>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
