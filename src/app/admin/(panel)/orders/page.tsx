import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/admin";
import { listOrders } from "@/lib/admin/queries";
import { ORDER_STATUSES, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/format";
import { FilterBar } from "@/components/admin/filters";
import {
  EmptyRow,
  OrderStatusPill,
  PageHeader,
  Pagination,
  Panel,
  PaymentStatusPill,
  Table,
  Td,
  Th,
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders" };

/**
 * Orders list. Search, filtering and pagination all run in PostgreSQL —
 * the page never loads more than one page of rows.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("orders.view");
  const params = await searchParams;

  const result = await listOrders({
    q: params.q,
    status: params.status,
    paymentStatus: params.paymentStatus,
    paymentMethod: params.paymentMethod,
    page: params.page,
  });

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order placed on the storefront. Search by order number, email, phone, name, payment ID or tracking ID."
      />

      <Panel>
        <FilterBar
          action="/admin/orders"
          placeholder="BV-260203-4821, email, phone, pay_…"
          q={params.q}
          selects={[
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: ORDER_STATUSES.map((status) => ({
                value: status,
                label: humanize(status),
              })),
            },
            {
              name: "paymentStatus",
              label: "Payment",
              value: params.paymentStatus,
              options: Object.entries(PAYMENT_STATUS_LABELS).map(
                ([value, label]) => ({ value, label }),
              ),
            },
            {
              name: "paymentMethod",
              label: "Method",
              value: params.paymentMethod,
              options: [
                { value: "cod", label: "Cash on delivery" },
                { value: "online", label: "Online" },
              ],
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Ship to</Th>
              <Th>Qty</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th>Placed</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={8}>
                No orders match these filters.
              </EmptyRow>
            ) : (
              result.rows.map((order) => (
                <tr key={order.id} className="hover:bg-cream/50">
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono font-bold text-ink hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td>
                    <span className="block font-semibold text-ink">
                      {order.customerName}
                    </span>
                    <span className="block text-[12.5px] text-ink-soft">
                      {order.email}
                    </span>
                  </Td>
                  <Td className="text-ink-soft">
                    {order.city}, {order.state}
                  </Td>
                  <Td className="font-mono tabular-nums">{order.quantity}</Td>
                  <Td className="whitespace-nowrap font-mono font-bold tabular-nums">
                    {formatINR(order.totalInPaise)}
                    {order.refundedInPaise > 0 ? (
                      <span className="block text-[12px] font-semibold text-chili">
                        −{formatINR(order.refundedInPaise)} refunded
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <OrderStatusPill status={order.status} />
                  </Td>
                  <Td>
                    <PaymentStatusPill status={order.paymentStatus} />
                    <span className="mt-1 block text-[11.5px] font-semibold uppercase text-ink-faint">
                      {order.paymentMethod}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(order.createdAt)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          basePath="/admin/orders"
          params={params}
        />
      </Panel>
    </>
  );
}
