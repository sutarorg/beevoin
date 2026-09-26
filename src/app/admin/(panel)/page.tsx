import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/admin";
import { getDashboardMetrics } from "@/lib/admin-metrics";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  EmptyRow,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatusPill,
  TableWrap,
  Td,
  Th,
  paymentTone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const admin = await requirePermissionPage("dashboard.view");
  const m = await getDashboardMetrics();

  const alerts: Array<{ label: string; href: string }> = [];
  if (m.alerts.lowStock && m.product) {
    alerts.push({
      label: `Low stock — only ${m.product.inventoryQuantity} unit${m.product.inventoryQuantity === 1 ? "" : "s"} left`,
      href: "/admin/inventory",
    });
  }
  if (m.queue.failedPayments > 0) {
    alerts.push({
      label: `${m.queue.failedPayments} order${m.queue.failedPayments === 1 ? "" : "s"} with failed payments`,
      href: "/admin/orders?payment=unpaid",
    });
  }
  if (m.alerts.unprocessedWebhooks > 0) {
    alerts.push({
      label: `${m.alerts.unprocessedWebhooks} webhook event${m.alerts.unprocessedWebhooks === 1 ? "" : "s"} not processed`,
      href: "/admin/webhooks",
    });
  }
  if (m.alerts.failedEmails > 0) {
    alerts.push({
      label: `${m.alerts.failedEmails} email${m.alerts.failedEmails === 1 ? "" : "s"} failed to send`,
      href: "/admin/emails",
    });
  }
  if (m.alerts.pendingRefunds > 0) {
    alerts.push({
      label: `${m.alerts.pendingRefunds} refund${m.alerts.pendingRefunds === 1 ? "" : "s"} still processing`,
      href: "/admin/refunds",
    });
  }
  if (m.alerts.unresolvedMessages > 0) {
    alerts.push({
      label: `${m.alerts.unresolvedMessages} customer message${m.alerts.unresolvedMessages === 1 ? "" : "s"} waiting`,
      href: "/admin/messages",
    });
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${admin.name?.split(" ")[0] || admin.email.split("@")[0]}`}
        subtitle="Live numbers straight from the order book — nothing here is estimated."
      />

      {alerts.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-haldi/40 bg-haldi-soft/60 p-4">
          <p className="flex items-center gap-2 text-[13px] font-extrabold text-haldi">
            <AlertTriangle className="size-4" aria-hidden />
            Needs your attention
          </p>
          <ul className="mt-2 space-y-1">
            {alerts.map((alert) => (
              <li key={alert.href + alert.label}>
                <Link
                  href={alert.href}
                  className="text-[13px] font-bold text-ink underline underline-offset-2 hover:text-accent-deep"
                >
                  {alert.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={formatINR(m.today.netInPaise)}
          hint={`${m.today.orders} order${m.today.orders === 1 ? "" : "s"} placed`}
          tone="accent"
        />
        <StatCard
          label="Last 7 days"
          value={formatINR(m.week.netInPaise)}
          hint={`${m.week.units} unit${m.week.units === 1 ? "" : "s"} collected`}
        />
        <StatCard
          label="Last 30 days"
          value={formatINR(m.month.netInPaise)}
          hint={`${m.month.orders} orders · ${m.month.cancelled} cancelled`}
        />
        <StatCard
          label="Lifetime net revenue"
          value={formatINR(m.lifetime.netInPaise)}
          hint={`${formatINR(m.lifetime.refundedInPaise)} refunded`}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="To pack"
          value={m.queue.awaitingFulfilment}
          hint="Confirmed & processing"
          href="/admin/orders?status=confirmed"
        />
        <StatCard
          label="In transit"
          value={m.queue.inTransit}
          hint="Shipped & out for delivery"
          href="/admin/orders?status=shipped"
        />
        <StatCard
          label="Awaiting payment"
          value={m.queue.paymentPending}
          hint="Online checkouts not completed"
          href="/admin/orders?status=payment_pending"
        />
        <StatCard
          label="Stock on hand"
          value={m.product ? m.product.inventoryQuantity : "—"}
          hint={m.product ? m.product.sku : "No active product"}
          href="/admin/inventory"
          tone={m.alerts.lowStock ? "warn" : "default"}
        />
      </div>

      <div className="mt-6">
        <Panel
          title="Latest orders"
          action={
            <Link
              href="/admin/orders"
              className="text-[13px] font-bold text-accent-deep hover:underline"
            >
              View all
            </Link>
          }
        >
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
              {m.recent.length === 0 ? (
                <EmptyRow colSpan={6}>
                  No orders yet. Your first sale will appear here instantly.
                </EmptyRow>
              ) : (
                m.recent.map((order) => (
                  <tr key={order.id} className="hover:bg-cream/50">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-extrabold text-ink hover:text-accent-deep"
                      >
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>
                      {order.customerName}
                      <span className="block text-[12px] font-semibold text-ink-faint">
                        {order.city}, {order.state}
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
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}
