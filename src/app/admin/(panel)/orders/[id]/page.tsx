import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, MailCheck } from "lucide-react";
import { db } from "@/db";
import { emailLogs, orderEvents, orders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { STATUS_META } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/format";
import { AdminStatusForm } from "@/components/admin-status-form";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();

  const [events, emails] = await Promise.all([
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt)),
    db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.orderId, order.id))
      .orderBy(asc(emailLogs.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-ink">
            {order.orderNumber}
          </h1>
          <p className="text-[13px] font-semibold text-ink-faint">
            Placed {formatDateTime(order.createdAt)} · last update{" "}
            {formatDateTime(order.updatedAt)}
          </p>
        </div>
        <span className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-extrabold text-paper">
          {STATUS_META[order.status].label}
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {/* Customer & address */}
          <section className="rounded-2xl border border-sandline bg-card p-6">
            <h2 className="text-[12.5px] font-extrabold uppercase tracking-wider text-ink-faint">
              Customer & delivery
            </h2>
            <div className="mt-3.5 grid gap-5 sm:grid-cols-2 text-[14px]">
              <div>
                <p className="font-bold text-ink">{order.customerName}</p>
                <p className="mt-1 font-semibold text-ink-soft">
                  {order.email}
                  <br />
                  +91 {order.phone}
                </p>
              </div>
              <p className="font-semibold leading-relaxed text-ink-soft">
                {order.addressLine1}
                {order.addressLine2 ? `, ${order.addressLine2}` : ""}
                <br />
                {order.locality}, {order.city}
                <br />
                {order.state} — {order.pincode}
              </p>
            </div>
          </section>

          {/* Items & payment */}
          <section className="rounded-2xl border border-sandline bg-card p-6">
            <h2 className="text-[12.5px] font-extrabold uppercase tracking-wider text-ink-faint">
              Items & payment
            </h2>
            <dl className="mt-3.5 space-y-2 text-[14px]">
              <div className="flex justify-between">
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
              <div className="flex justify-between border-t border-dashed border-sandline pt-2">
                <dt className="font-bold text-ink">Total</dt>
                <dd className="font-mono font-bold tabular-nums">
                  {formatINR(order.totalInPaise)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-2 rounded-xl bg-cream/60 p-4 text-[13px] font-semibold text-ink-soft sm:grid-cols-2">
              <p>
                Method:{" "}
                <span className="font-bold text-ink">
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online (Razorpay)"}
                </span>
              </p>
              <p>
                Payment status:{" "}
                <span className="font-bold text-ink">{order.paymentStatus}</span>
              </p>
              {order.razorpayOrderId ? (
                <p className="break-all">
                  RZP order:{" "}
                  <span className="font-mono text-[12px] font-bold text-ink">
                    {order.razorpayOrderId}
                  </span>
                </p>
              ) : null}
              {order.razorpayPaymentId ? (
                <p className="break-all">
                  RZP payment:{" "}
                  <span className="font-mono text-[12px] font-bold text-ink">
                    {order.razorpayPaymentId}
                  </span>
                </p>
              ) : null}
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-2xl border border-sandline bg-card p-6">
            <h2 className="text-[12.5px] font-extrabold uppercase tracking-wider text-ink-faint">
              Order history
            </h2>
            <ol className="mt-4 space-y-3.5">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-[13.5px]">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                  <div>
                    <p className="font-bold text-ink">
                      {STATUS_META[event.status].label}
                    </p>
                    {event.note ? (
                      <p className="font-semibold text-ink-soft">{event.note}</p>
                    ) : null}
                    <p className="text-[12px] font-semibold text-ink-faint">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Emails */}
          <section className="rounded-2xl border border-sandline bg-card p-6">
            <h2 className="flex items-center gap-2 text-[12.5px] font-extrabold uppercase tracking-wider text-ink-faint">
              <MailCheck className="size-4" aria-hidden />
              Transactional emails ({emails.length})
            </h2>
            {emails.length === 0 ? (
              <p className="mt-3 text-[13.5px] font-semibold text-ink-soft">
                No emails recorded for this order yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-sandline/60">
                {emails.map((mail) => (
                  <li key={mail.id} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{mail.subject}</p>
                      <p className="font-semibold text-ink-faint">
                        {formatDateTime(mail.createdAt)} → {mail.toEmail}
                      </p>
                    </div>
                    <span
                      className={
                        mail.delivery === "sent"
                          ? "rounded-full bg-leaf-soft px-2.5 py-1 text-[11px] font-extrabold text-leaf"
                          : mail.delivery === "failed"
                            ? "rounded-full bg-chili-soft px-2.5 py-1 text-[11px] font-extrabold text-chili"
                            : "rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold text-ink-soft"
                      }
                    >
                      {mail.delivery}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <AdminStatusForm
          orderId={order.id}
          currentStatus={order.status}
          courierName={order.courierName ?? ""}
          trackingId={order.trackingId ?? ""}
        />
      </div>
    </div>
  );
}
