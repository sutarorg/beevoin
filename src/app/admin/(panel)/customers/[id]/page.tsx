import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/admin";
import { getCustomerDetail } from "@/lib/admin/queries";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  EmptyRow,
  OrderStatusPill,
  PageHeader,
  Panel,
  PaymentStatusPill,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("customers.view");
  const { id } = await params;

  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { customer, orders } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All customers
      </Link>

      <PageHeader
        title={customer.name}
        description={`${customer.email} · +91 ${customer.phone}`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Orders" value={String(customer.totalOrders)} />
        <StatCard
          label="Net spend"
          value={formatINR(customer.totalSpentInPaise)}
          hint="Refunds already deducted"
        />
        <StatCard
          label="Customer since"
          value={
            customer.firstOrderAt
              ? formatDateTime(customer.firstOrderAt).split(",")[0]
              : "—"
          }
        />
      </div>

      <Panel title="Order history">
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th>Placed</Th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <EmptyRow colSpan={5}>No orders for this customer.</EmptyRow>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-cream/50">
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono font-bold text-ink hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td className="font-mono font-bold tabular-nums">
                    {formatINR(order.totalInPaise)}
                  </Td>
                  <Td>
                    <OrderStatusPill status={order.status} />
                  </Td>
                  <Td>
                    <PaymentStatusPill status={order.paymentStatus} />
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(order.createdAt)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
