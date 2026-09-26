import Link from "next/link";
import type { OrderStatus } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { searchOrders } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_META } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  StatusPill,
  TableWrap,
  Td,
  Th,
  paymentTone,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermissionPage("orders.view");
  const params = await searchParams;

  const query = single(params.q);
  const status = single(params.status) ?? "all";
  const payment = single(params.payment) ?? "all";
  const from = single(params.from);
  const to = single(params.to);
  const sort = single(params.sort) ?? "newest";
  const page = Number(single(params.page) ?? 1) || 1;

  const result = await searchOrders({
    query,
    status: status as OrderStatus | "all",
    payment: payment as "cod" | "online" | "paid" | "unpaid" | "all",
    from,
    to,
    sort: sort as "newest" | "oldest" | "amount",
    page,
  });

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Search, filter and open any order. All filtering happens on the server."
      />

      <Panel>
        <form
          method="get"
          className="grid gap-2.5 border-b border-sandline px-5 py-4 sm:grid-cols-2 lg:grid-cols-7"
        >
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Order ID, name, email, phone, AWB"
            aria-label="Search orders"
            className={`${adminInput} lg:col-span-2`}
          />
          <select
            name="status"
            defaultValue={status}
            aria-label="Status"
            className={adminInput}
          >
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label}
              </option>
            ))}
          </select>
          <select
            name="payment"
            defaultValue={payment}
            aria-label="Payment"
            className={adminInput}
          >
            <option value="all">All payments</option>
            <option value="cod">Cash on Delivery</option>
            <option value="online">Online</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid</option>
          </select>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            aria-label="From date"
            className={adminInput}
          />
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            aria-label="To date"
            className={adminInput}
          />
          <div className="flex gap-2">
            <select
              name="sort"
              defaultValue={sort}
              aria-label="Sort"
              className={adminInput}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="amount">Highest value</option>
            </select>
            <button
              type="submit"
              className="min-h-10 shrink-0 rounded-full bg-ink px-5 text-sm font-bold text-paper hover:bg-black"
            >
              Filter
            </button>
          </div>
        </form>

        <TableWrap>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Placed</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={6}>
                No orders match these filters.{" "}
                <Link href="/admin/orders" className="underline">
                  Clear filters
                </Link>
              </EmptyRow>
            ) : (
              result.rows.map((order) => (
                <tr key={order.id} className="hover:bg-cream/50">
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-extrabold text-ink hover:text-accent-deep"
                    >
                      {order.orderNumber}
                    </Link>
                    <span className="block text-[12px] font-semibold text-ink-faint">
                      {order.quantity} × {order.productSku}
                    </span>
                  </Td>
                  <Td>
                    {order.customerName}
                    <span className="block text-[12px] font-semibold text-ink-faint">
                      {order.city}, {order.state} · {order.pincode}
                    </span>
                  </Td>
                  <Td>{formatDateTime(order.createdAt)}</Td>
                  <Td>
                    <Pill tone={paymentTone(order.paymentStatus)}>
                      {order.paymentMethod === "cod" ? "COD" : "Online"} ·{" "}
                      {order.paymentStatus}
                    </Pill>
                  </Td>
                  <Td>
                    <StatusPill status={order.status} />
                  </Td>
                  <Td className="text-right font-extrabold text-ink">
                    {formatINR(order.totalInPaise)}
                    {order.refundedInPaise > 0 ? (
                      <span className="block text-[12px] font-bold text-chili">
                        −{formatINR(order.refundedInPaise)} refunded
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>

        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          basePath="/admin/orders"
          params={{ q: query, status, payment, from, to, sort }}
        />
      </Panel>
    </>
  );
}
