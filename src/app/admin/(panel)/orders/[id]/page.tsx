import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { paymentsForOrder } from "@/lib/admin-metrics";
import { formatDateTime, formatINR } from "@/lib/format";
import { allowedNextStatuses, STATUS_META } from "@/lib/order-status";
import {
  customerForOrder,
  getOrderById,
  getOrderEvents,
  getOrderItems,
} from "@/lib/orders";
import { listRefundsForOrder, refundableInfo } from "@/lib/refunds";
import {
  DefinitionList,
  EmptyRow,
  Note,
  PageHeader,
  Panel,
  Pill,
  StatusPill,
  TableWrap,
  Td,
  Th,
  paymentTone,
} from "@/components/admin/ui";
import {
  FulfillmentForm,
  RefundForm,
  StatusForm,
} from "@/components/admin/order-forms";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  return { title: order ? `Order ${order.orderNumber}` : "Order" };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePermissionPage("orders.view");
  const { id } = await params;

  const order = await getOrderById(id);
  if (!order) notFound();

  const [items, events, orderPayments, orderRefunds, refundable, customer, emails] =
    await Promise.all([
      getOrderItems(order.id),
      getOrderEvents(order.id),
      paymentsForOrder(order.id),
      listRefundsForOrder(order.id),
      refundableInfo(order),
      customerForOrder(order),
      db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.orderId, order.id))
        .orderBy(desc(emailLogs.createdAt)),
    ]);

  const canUpdateStatus = roleHasPermission(admin.role, "orders.update_status");
  const canFulfil = roleHasPermission(admin.role, "orders.update_fulfillment");
  const canRefund = roleHasPermission(admin.role, "refunds.create");
  const canSeePayments = roleHasPermission(admin.role, "payments.view");

  const address = [
    order.addressLine1,
    order.addressLine2,
    order.locality,
    `${order.city}, ${order.state} ${order.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={`Placed ${formatDateTime(order.createdAt)} · ${STATUS_META[order.status].blurb}`}
        action={
          <div className="flex items-center gap-2">
            <StatusPill status={order.status} />
            <Pill tone={paymentTone(order.paymentStatus)}>
              {order.paymentMethod === "cod" ? "COD" : "Online"} ·{" "}
              {order.paymentStatus}
            </Pill>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Panel title="Items">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Unit</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {(items.length > 0
                  ? items.map((item) => ({
                      name: item.productNameSnapshot,
                      sku: item.skuSnapshot,
                      unit: item.unitPriceInPaise,
                      quantity: item.quantity,
                      total: item.totalInPaise,
                    }))
                  : [
                      {
                        name: order.productName,
                        sku: order.productSku,
                        unit: order.unitPriceInPaise,
                        quantity: order.quantity,
                        total: order.unitPriceInPaise * order.quantity,
                      },
                    ]
                ).map((line) => (
                  <tr key={line.sku}>
                    <Td>
                      <span className="font-extrabold text-ink">{line.name}</span>
                      <span className="block text-[12px] font-semibold text-ink-faint">
                        {line.sku}
                      </span>
                    </Td>
                    <Td className="text-right">{formatINR(line.unit)}</Td>
                    <Td className="text-right">{line.quantity}</Td>
                    <Td className="text-right font-extrabold text-ink">
                      {formatINR(line.total)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <DefinitionList
              items={[
                {
                  label: "Shipping",
                  value:
                    order.shippingInPaise === 0
                      ? "Free"
                      : formatINR(order.shippingInPaise),
                },
                { label: "Order total", value: formatINR(order.totalInPaise) },
                ...(order.refundedInPaise > 0
                  ? [
                      {
                        label: "Refunded",
                        value: `−${formatINR(order.refundedInPaise)}`,
                      },
                      {
                        label: "Net",
                        value: formatINR(
                          order.totalInPaise - order.refundedInPaise,
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>

          <Panel title="Customer & delivery">
            <DefinitionList
              items={[
                {
                  label: "Name",
                  value: customer ? (
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="text-accent-deep hover:underline"
                    >
                      {order.customerName}
                    </Link>
                  ) : (
                    order.customerName
                  ),
                },
                {
                  label: "Email",
                  value: (
                    <a
                      href={`mailto:${order.email}`}
                      className="text-accent-deep hover:underline"
                    >
                      {order.email}
                    </a>
                  ),
                },
                {
                  label: "Phone",
                  value: (
                    <a
                      href={`tel:+91${order.phone}`}
                      className="text-accent-deep hover:underline"
                    >
                      +91 {order.phone}
                    </a>
                  ),
                },
                { label: "Address", value: address },
                {
                  label: "Courier",
                  value: order.courierName ?? "Not assigned",
                },
                {
                  label: "Tracking ID",
                  value: order.trackingId ?? "—",
                },
              ]}
            />
          </Panel>

          {canSeePayments ? (
            <Panel title="Payments">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Payment ID</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th>When</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {orderPayments.length === 0 ? (
                    <EmptyRow colSpan={5}>
                      {order.paymentMethod === "cod"
                        ? "Cash on Delivery — collected by the courier."
                        : "No payment attempt recorded yet."}
                    </EmptyRow>
                  ) : (
                    orderPayments.map((payment) => (
                      <tr key={payment.id}>
                        <Td>
                          <span className="font-mono text-[12px] font-bold text-ink">
                            {payment.providerPaymentId ?? "—"}
                          </span>
                          <span className="block font-mono text-[11px] text-ink-faint">
                            {payment.providerOrderId}
                          </span>
                        </Td>
                        <Td>{payment.method ?? "—"}</Td>
                        <Td>
                          <Pill tone={paymentTone(payment.status)}>
                            {payment.status}
                          </Pill>
                          {payment.verified ? (
                            <span className="ml-1.5 text-[11px] font-bold text-leaf">
                              verified
                            </span>
                          ) : null}
                        </Td>
                        <Td>{formatDateTime(payment.createdAt)}</Td>
                        <Td className="text-right font-extrabold text-ink">
                          {formatINR(payment.amountInPaise)}
                          {payment.amountRefundedInPaise > 0 ? (
                            <span className="block text-[12px] font-bold text-chili">
                              −{formatINR(payment.amountRefundedInPaise)}
                            </span>
                          ) : null}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </TableWrap>
            </Panel>
          ) : null}

          {orderRefunds.length > 0 ? (
            <Panel title="Refunds">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Refund ID</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                    <Th>Requested</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {orderRefunds.map((refund) => (
                    <tr key={refund.id}>
                      <Td>
                        <span className="font-mono text-[12px] font-bold text-ink">
                          {refund.providerRefundId ?? "pending"}
                        </span>
                      </Td>
                      <Td>{refund.reason}</Td>
                      <Td>
                        <Pill
                          tone={
                            refund.status === "processed"
                              ? "good"
                              : refund.status === "failed"
                                ? "bad"
                                : "warn"
                          }
                        >
                          {refund.status}
                        </Pill>
                      </Td>
                      <Td>{formatDateTime(refund.createdAt)}</Td>
                      <Td className="text-right font-extrabold text-ink">
                        {formatINR(refund.amountInPaise)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          ) : null}

          <Panel title="Timeline" description="Every status change, with who did it.">
            <ol className="space-y-3 px-5 py-4">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                    aria-hidden
                  />
                  <div>
                    <p className="text-[13px] font-extrabold text-ink">
                      {STATUS_META[event.status]?.label ?? event.status}
                      {event.previousStatus &&
                      event.previousStatus !== event.status ? (
                        <span className="font-semibold text-ink-faint">
                          {" "}
                          ← {STATUS_META[event.previousStatus]?.label}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[12px] font-semibold text-ink-faint">
                      {formatDateTime(event.createdAt)} ·{" "}
                      {event.actorLabel ?? event.actorType}
                    </p>
                    {event.note ? (
                      <p className="mt-0.5 text-[13px] font-semibold text-ink-soft">
                        {event.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Emails sent for this order">
            <TableWrap>
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
                  <EmptyRow colSpan={4}>No emails yet.</EmptyRow>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id}>
                      <Td>{email.template}</Td>
                      <Td>{email.toEmail}</Td>
                      <Td>
                        <Pill
                          tone={
                            email.delivery === "sent"
                              ? "good"
                              : email.delivery === "failed"
                                ? "bad"
                                : "muted"
                          }
                        >
                          {email.delivery}
                        </Pill>
                      </Td>
                      <Td>{formatDateTime(email.createdAt)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </Panel>
        </div>

        <div className="space-y-5">
          {canUpdateStatus ? (
            <Panel title="Update status">
              <StatusForm
                orderId={order.id}
                status={order.status}
                options={allowedNextStatuses(order.status)}
                courierName={order.courierName}
                trackingId={order.trackingId}
              />
            </Panel>
          ) : null}

          {canFulfil ? (
            <Panel
              title="Courier details"
              description="Update tracking without changing the status."
            >
              <FulfillmentForm
                orderId={order.id}
                courierName={order.courierName}
                trackingId={order.trackingId}
              />
            </Panel>
          ) : null}

          {canRefund ? (
            <Panel title="Refund">
              {refundable.canRefund ? (
                <RefundForm
                  orderId={order.id}
                  refundableInPaise={refundable.refundableInPaise}
                  delivered={order.status === "delivered"}
                />
              ) : (
                <div className="px-5 py-4">
                  <Note>{refundable.reason}</Note>
                </div>
              )}
            </Panel>
          ) : null}

          <Panel title="Internals">
            <DefinitionList
              items={[
                { label: "Order ID", value: order.id.slice(0, 8) },
                {
                  label: "Razorpay order",
                  value: order.razorpayOrderId ?? "—",
                },
                {
                  label: "Stock committed",
                  value: order.inventoryCommittedAt
                    ? formatDateTime(order.inventoryCommittedAt)
                    : "No",
                },
                {
                  label: "Stock released",
                  value: order.inventoryReleasedAt
                    ? formatDateTime(order.inventoryReleasedAt)
                    : "No",
                },
                {
                  label: "Tracking link",
                  value: (
                    <Link
                      href={`/track?order=${order.orderNumber}&key=${order.lookupSecret}`}
                      className="text-accent-deep hover:underline"
                    >
                      Customer view
                    </Link>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
