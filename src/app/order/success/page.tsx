import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  HandCoins,
  Mail,
  PackageSearch,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { Card, Container, Section, buttonClasses } from "@/components/ui";
import {
  OrderStatusBanner,
  OrderTimeline,
  buildStepStates,
} from "@/components/order-timeline";
import { getOrderByNumber, getOrderEvents } from "@/lib/orders";
import { orderNumberRegex } from "@/lib/validations";
import { formatDateTime, formatINR } from "@/lib/format";
import { policies } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const { order: orderNumber, key } = await searchParams;

  const order =
    orderNumber && key && orderNumberRegex.test(orderNumber)
      ? await getOrderByNumber(orderNumber)
      : undefined;

  if (!order || order.lookupSecret !== key) {
    return (
      <Section className="pt-16">
        <Container className="max-w-xl">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <TriangleAlert className="size-10 text-haldi" aria-hidden />
            <h1 className="font-display text-2xl font-semibold text-ink">
              We can&apos;t show this order
            </h1>
            <p className="text-sm leading-relaxed text-ink-soft">
              The link is incomplete or has expired. You can still check your
              order with your order ID and registered mobile number or email.
            </p>
            <Link href="/track" className={buttonClasses()}>
              <PackageSearch className="size-4.5" aria-hidden />
              Track your order
            </Link>
          </Card>
        </Container>
      </Section>
    );
  }

  const events = await getOrderEvents(order.id);
  const steps = buildStepStates(order.status, events);
  const paid = order.paymentStatus === "paid";
  const isCod = order.paymentMethod === "cod";

  return (
    <Section className="pt-12 md:pt-16">
      <Container className="max-w-3xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-leaf-soft">
            <CheckCircle2 className="size-9 text-leaf" aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {isCod ? "Order placed — thank you!" : "Payment successful!"}
          </h1>
          <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-ink-soft">
            {order.customerName.split(" ")[0]}, your{" "}
            <span className="font-bold text-ink">{order.productName}</span> is
            confirmed. A confirmation email is on its way to{" "}
            <span className="font-bold text-ink">{order.email}</span>.
          </p>
          <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-dashed border-ink-faint/50 bg-white px-5 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">
              Order ID
            </span>
            <span className="font-mono text-[15px] font-bold text-ink">
              {order.orderNumber}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink-faint">
            <Mail className="size-3.5" aria-hidden />
            Save this ID — you&apos;ll need it to track your order.
          </p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {/* Status */}
          <Card className="p-6">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
              Order status
            </h2>
            <div className="mt-4 space-y-4">
              {order.status !== "confirmed" ? (
                <OrderStatusBanner status={order.status} />
              ) : null}
              <OrderTimeline steps={steps} />
            </div>
          </Card>

          {/* Summary */}
          <div className="space-y-5">
            <Card className="p-6">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
                Order summary
              </h2>
              <dl className="mt-4 space-y-2.5 text-[14.5px]">
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold text-ink-soft">
                    {order.productName} × {order.quantity}
                  </dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {formatINR(order.unitPriceInPaise * order.quantity)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink-soft">Shipping</dt>
                  <dd className="font-bold text-leaf">
                    {order.shippingInPaise === 0
                      ? "FREE"
                      : formatINR(order.shippingInPaise)}
                  </dd>
                </div>
                <div className="dashed-rule my-1.5" />
                <div className="flex items-baseline justify-between">
                  <dt className="font-bold text-ink">Total</dt>
                  <dd className="font-mono text-lg font-bold tabular-nums">
                    {formatINR(order.totalInPaise)}
                  </dd>
                </div>
              </dl>
              <p
                className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-[13px] font-bold ${
                  paid ? "bg-leaf-soft text-leaf" : "bg-haldi-soft text-haldi"
                }`}
              >
                <HandCoins className="size-4.5 shrink-0" aria-hidden />
                {paid
                  ? "Paid online — receipt emailed."
                  : `Cash on Delivery — keep ${formatINR(order.totalInPaise)} ready (cash or UPI).`}
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
                Delivering to
              </h2>
              <p className="mt-3 text-[14.5px] font-bold text-ink">
                {order.customerName}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                {order.addressLine1}
                {order.addressLine2 ? `, ${order.addressLine2}` : ""},{" "}
                {order.locality}, {order.city}, {order.state} — {order.pincode}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink-soft">
                +91 {order.phone}
              </p>
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-cream/70 p-3 text-[13px] font-bold text-ink-soft">
                <Truck className="size-4.5 shrink-0 text-leaf" aria-hidden />
                Dispatch in {policies.dispatchWindow} · delivery in{" "}
                {policies.deliveryEstimate}.
              </p>
            </Card>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/track?order=${order.orderNumber}&key=${order.lookupSecret}`}
            className={buttonClasses({ variant: "dark", size: "lg" })}
          >
            <PackageSearch className="size-4.5" aria-hidden />
            Track this order
          </Link>
          <Link href="/" className={buttonClasses({ variant: "ghost" })}>
            Back to beevo →
          </Link>
        </div>
        <p className="mt-6 text-center text-[12.5px] text-ink-faint">
          Placed on {formatDateTime(order.createdAt)} (IST).
        </p>
      </Container>
    </Section>
  );
}
