import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import {
  adminUsers,
  emailLogs,
  inventoryEvents,
  orderEvents,
  orderItems,
  orders,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { nextStatuses, STATUS_META } from "@/lib/order-status";
import { getPaymentsForOrder } from "@/lib/services/payments";
import { getRefundable, listRefundsForOrder } from "@/lib/services/refunds";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  FulfillmentForm,
  OrderStatusForm,
  RefundForm,
} from "@/components/admin/order-forms";
import {
  EmptyRow,
  OrderStatusPill,
  Panel,
  PaymentStatusPill,
  Pill,
  Table,
  Td,
  Th,
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [order] = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  return { title: order ? `Order ${order.orderNumber}` : "Order" };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-sandline/70 px-5 py-2.5 text-[13.5px] last:border-b-0">
      <dt className="font-semibold text-ink-soft">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

/**
 * Single order — the operator's main workspace.
 *
 * Everything on this page is the order's own historical record: the product
 * name, SKU, unit price and totals are the snapshot taken at checkout, so
 * editing the product later never rewrites what the customer bought.
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission("orders.view");
  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) notFound();

  const [events, emails, items, paymentRows, refundRows, stockEvents, refundable] =
    await Promise.all([
      db
        .select({
          id: orderEvents.id,
          previousStatus: orderEvents.previousStatus,
          status: orderEvents.status,
          actor: orderEvents.actor,
          note: orderEvents.note,
          createdAt: orderEvents.createdAt,
          adminEmail: adminUsers.email,
        })
        .from(orderEvents)
        .leftJoin(adminUsers, eq(adminUsers.id, orderEvents.actorAdminId))
        .where(eq(orderEvents.orderId, order.id))
        .orderBy(asc(orderEvents.createdAt)),
      db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.orderId, order.id))
        .orderBy(asc(emailLogs.createdAt)),
      db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id)),
      getPaymentsForOrder(order.id),
      listRefundsForOrder(order.id),
      db
        .select()
        .from(inventoryEvents)
        .where(eq(inventoryEvents.orderId, order.id))
        .orderBy(desc(inventoryEvents.createdAt)),
      getRefundable(order),
    ]);

  const canRefund =
    roleHasPermission(actor.role, "refunds.create") && refundable.eligible;
  const canChangeStatus = roleHasPermission(actor.role, "orders.update_status");
  const canFulfil = roleHasPermission(actor.role, "orders.update_fulfillment");

  const allowed = nextStatuses(order.status)
    // "refunded" is reached only through the refund workflow, never manually.
    .filter((status) => status !== "refunded")
    .filter((status) =>
      status === "cancelled" ? roleHasPermission(actor.role, "orders.cancel") : true,
    )
    .map((status) => ({ value: status, label: STATUS_META[status].label }));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-ink-soft hover:text-ink"
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
            Placed {formatDateTime(order.createdAt)} · updated{" "}
            {formatDateTime(order.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusPill status={order.status} />
          <PaymentStatusPill status={order.paymentStatus} />
          <Pill tone="neutral">{order.paymentMethod.toUpperCase()}</Pill>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <Panel title="Items — snapshot taken at checkout">
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>Unit price</Th>
                  <Th>Qty</Th>
                  <Th>Line total</Th>
                </tr>
              </thead>
              <tbody>
                {(items.length > 0
                  ? items
                  : [
                      {
                        id: order.id,
                        productNameSnapshot: order.productName,
                        skuSnapshot: order.productSku,
                        unitPriceInPaise: order.unitPriceInPaise,
                        quantity: order.quantity,
                        totalInPaise: order.unitPriceInPaise * order.quantity,
                      },
                    ]
                ).map((item) => (
                  <tr key={item.id}>
                    <Td className="font-semibold">{item.productNameSnapshot}</Td>
                    <Td className="font-mono text-ink-soft">
                      {item.skuSnapshot}
                    </Td>
                    <Td className="font-mono tabular-nums">
                      {formatINR(item.unitPriceInPaise)}
                    </Td>
                    <Td className="font-mono tabular-nums">{item.quantity}</Td>
                    <Td className="font-mono font-bold tabular-nums">
                      {formatINR(item.totalInPaise)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <dl>
              <Row
                label="Shipping"
                value={
                  order.shippingInPaise === 0
                    ? "Free"
                    : formatINR(order.shippingInPaise)
                }
              />
              <Row
                label="Order total"
                value={
                  <span className="font-mono text-base">
                    {formatINR(order.totalInPaise)}
                  </span>
                }
              />
              {order.refundedInPaise > 0 ? (
                <Row
                  label="Refunded"
                  value={
                    <span className="font-mono text-chili">
                      −{formatINR(order.refundedInPaise)}
                    </span>
                  }
                />
              ) : null}
            </dl>
          </Panel>

          <Panel title="Payments">
            <Table>
              <thead>
                <tr>
                  <Th>Payment ID</Th>
                  <Th>Method</Th>
                  <Th>Amount</Th>
                  <Th>Refunded</Th>
                  <Th>Status</Th>
                  <Th>Verified</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.length === 0 ? (
                  <EmptyRow colSpan={7}>
                    {order.paymentMethod === "cod"
                      ? "Cash on delivery — no gateway payment."
                      : "No payment attempt recorded yet."}
                  </EmptyRow>
                ) : (
                  paymentRows.map((payment) => (
                    <tr key={payment.id}>
                      <Td className="font-mono text-[12.5px]">
                        {payment.providerPaymentId ?? "—"}
                      </Td>
                      <Td>{payment.method ?? "—"}</Td>
                      <Td className="font-mono tabular-nums">
                        {formatINR(payment.amountInPaise)}
                      </Td>
                      <Td className="font-mono tabular-nums">
                        {payment.amountRefundedInPaise > 0
                          ? formatINR(payment.amountRefundedInPaise)
                          : "—"}
                      </Td>
                      <Td>
                        <PaymentStatusPill status={payment.status} />
                        {payment.failureReason ? (
                          <span className="mt-1 block text-[12px] text-chili">
                            {payment.failureReason}
                          </span>
                        ) : null}
                      </Td>
                      <Td>{payment.verified ? "Yes" : "No"}</Td>
                      <Td className="whitespace-nowrap text-ink-soft">
                        {formatDateTime(payment.createdAt)}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Panel>

          {refundRows.length > 0 ? (
            <Panel title="Refunds">
              <Table>
                <thead>
                  <tr>
                    <Th>Refund ID</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Reason</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody>
                  {refundRows.map((refund) => (
                    <tr key={refund.id}>
                      <Td className="font-mono text-[12.5px]">
                        {refund.providerRefundId ?? refund.id.slice(0, 8)}
                      </Td>
                      <Td className="font-mono tabular-nums">
                        {formatINR(refund.amountInPaise)}
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            refund.status === "processed"
                              ? "green"
                              : refund.status === "failed"
                                ? "red"
                                : "amber"
                          }
                        >
                          {humanize(refund.status)}
                        </Pill>
                      </Td>
                      <Td className="text-ink-soft">{refund.reason}</Td>
                      <Td className="whitespace-nowrap text-ink-soft">
                        {formatDateTime(refund.createdAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          ) : null}

          <Panel title="Timeline">
            <ol className="divide-y divide-sandline/70">
              {events.map((event) => (
                <li key={event.id} className="px-5 py-3 text-[13.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-ink">
                      {event.previousStatus
                        ? `${STATUS_META[event.previousStatus].label} → `
                        : ""}
                      {STATUS_META[event.status].label}
                    </span>
                    <span className="text-[12.5px] text-ink-faint">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-soft">
                    by {event.adminEmail ?? event.actor}
                    {event.note ? ` — ${event.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          {stockEvents.length > 0 ? (
            <Panel title="Inventory movements for this order">
              <ul className="divide-y divide-sandline/70">
                {stockEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex justify-between px-5 py-2.5 text-[13.5px]"
                  >
                    <span className="text-ink-soft">
                      {humanize(event.reason)}
                      {event.note ? ` — ${event.note}` : ""}
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      {event.quantityChange > 0 ? "+" : ""}
                      {event.quantityChange} → {event.quantityAfter}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Emails sent">
            <Table>
              <thead>
                <tr>
                  <Th>Template</Th>
                  <Th>To</Th>
                  <Th>Delivery</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {emails.length === 0 ? (
                  <EmptyRow colSpan={4}>No emails sent for this order.</EmptyRow>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id}>
                      <Td className="font-semibold">{humanize(email.template)}</Td>
                      <Td className="text-ink-soft">{email.toEmail}</Td>
                      <Td>
                        <Pill
                          tone={
                            email.delivery === "sent"
                              ? "green"
                              : email.delivery === "failed"
                                ? "red"
                                : "neutral"
                          }
                        >
                          {humanize(email.delivery)}
                        </Pill>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-soft">
                        {formatDateTime(email.createdAt)}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Customer">
            <dl>
              <Row label="Name" value={order.customerName} />
              <Row label="Email" value={order.email} />
              <Row label="Phone" value={`+91 ${order.phone}`} />
            </dl>
          </Panel>

          <Panel title="Shipping address">
            <address className="px-5 py-4 text-[13.5px] not-italic leading-relaxed text-ink">
              {order.addressLine1}
              <br />
              {order.addressLine2 ? (
                <>
                  {order.addressLine2}
                  <br />
                </>
              ) : null}
              {order.locality ? (
                <>
                  {order.locality}
                  <br />
                </>
              ) : null}
              {order.city}, {order.state} {order.pincode}
            </address>
          </Panel>

          {canChangeStatus ? (
            <Panel title="Change status">
              <OrderStatusForm
                orderId={order.id}
                options={allowed}
                requiresTracking={allowed.some((o) => o.value === "shipped")}
              />
            </Panel>
          ) : null}

          {canFulfil ? (
            <Panel title="Courier & tracking">
              <FulfillmentForm
                orderId={order.id}
                courierName={order.courierName}
                trackingId={order.trackingId}
              />
            </Panel>
          ) : null}

          {roleHasPermission(actor.role, "refunds.view") ? (
            <Panel title="Refund">
              {canRefund && refundable.eligible ? (
                <RefundForm
                  orderId={order.id}
                  refundableInPaise={refundable.refundableInPaise}
                  alreadyRefundedInPaise={refundable.alreadyRefundedInPaise}
                />
              ) : (
                <p className="px-5 py-4 text-[13.5px] text-ink-soft">
                  {refundable.reason ??
                    "Your role cannot issue refunds for this order."}
                </p>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
