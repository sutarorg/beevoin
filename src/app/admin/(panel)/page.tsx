import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getDashboardMetrics } from "@/lib/admin/queries";
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
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Operations dashboard.
 *
 * Every number here is a live aggregate computed in PostgreSQL over real
 * orders. Nothing is mocked, estimated or padded — if the store has no orders
 * yet, the dashboard says so.
 */
export default async function AdminDashboardPage() {
  const actor = await requirePermission("dashboard.view");
  const metrics = await getDashboardMetrics();

  const product = metrics.product;
  const lowStock =
    product !== null && product.inventoryQuantity <= product.lowStockThreshold;

  const attention: { label: string; href: string; tone: "warn" | "bad" }[] = [];
  if (lowStock && product) {
    attention.push({
      label:
        product.inventoryQuantity === 0
          ? "Out of stock — the storefront cannot take orders"
          : `Low stock: only ${product.inventoryQuantity} units left`,
      href: "/admin/inventory",
      tone: product.inventoryQuantity === 0 ? "bad" : "warn",
    });
  }
  if (metrics.pendingPayments > 0) {
    attention.push({
      label: `${metrics.pendingPayments} online order(s) awaiting payment confirmation`,
      href: "/admin/orders?paymentStatus=created",
      tone: "warn",
    });
  }
  if (metrics.failedEmails > 0) {
    attention.push({
      label: `${metrics.failedEmails} email(s) failed to send`,
      href: "/admin/emails?delivery=failed",
      tone: "bad",
    });
  }
  if (metrics.unprocessedWebhooks > 0) {
    attention.push({
      label: `${metrics.unprocessedWebhooks} webhook event(s) not processed`,
      href: "/admin/webhooks?processed=false",
      tone: "bad",
    });
  }
  if (metrics.unreadMessages > 0) {
    attention.push({
      label: `${metrics.unreadMessages} customer message(s) awaiting a reply`,
      href: "/admin/messages",
      tone: "warn",
    });
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${actor.name.split(" ")[0]}`}
        description="Live operational view of the store. All figures are computed from real orders in the database."
      />

      {attention.length > 0 ? (
        <ul className="mb-6 space-y-2">
          {attention.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-[13.5px] font-bold transition ${
                  item.tone === "bad"
                    ? "border-chili/30 bg-chili-soft text-chili hover:border-chili/60"
                    : "border-haldi/30 bg-haldi-soft text-haldi hover:border-haldi/60"
                }`}
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                {item.label}
                <span className="ml-auto text-[12.5px] font-semibold opacity-70">
                  Review →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Net revenue · 30 days"
          value={formatINR(metrics.revenue30.net)}
          hint={`${metrics.revenue30.orders} paid/confirmed order(s), refunds deducted`}
        />
        <StatCard
          label="Net revenue · 7 days"
          value={formatINR(metrics.revenue7.net)}
          hint={`${metrics.revenue7.orders} order(s)`}
        />
        <StatCard
          label="Total orders"
          value={String(metrics.totalOrders)}
          hint="All time, every status"
          href="/admin/orders"
        />
        <StatCard
          label="Refunded"
          value={formatINR(metrics.refunds.totalInPaise)}
          hint={`${metrics.refunds.count} refund(s)`}
          href={roleHasPermission(actor.role, "refunds.view") ? "/admin/refunds" : undefined}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Recent orders">
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Placed</Th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentOrders.length === 0 ? (
                <EmptyRow colSpan={6}>
                  No orders yet. Once a customer checks out, they appear here
                  immediately.
                </EmptyRow>
              ) : (
                metrics.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono font-bold text-ink hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>{order.customerName}</Td>
                    <Td className="font-mono tabular-nums">
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

        <div className="space-y-5">
          <Panel title="Orders by status">
            <ul className="divide-y divide-sandline/70">
              {Object.entries(metrics.byStatus).length === 0 ? (
                <li className="px-5 py-6 text-center text-[13.5px] text-ink-soft">
                  No orders yet.
                </li>
              ) : (
                Object.entries(metrics.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, value]) => (
                    <li
                      key={status}
                      className="flex items-center justify-between px-5 py-2.5 text-[13.5px]"
                    >
                      <Link
                        href={`/admin/orders?status=${status}`}
                        className="font-semibold text-ink-soft hover:text-ink hover:underline"
                      >
                        {humanize(status)}
                      </Link>
                      <span className="font-mono font-bold tabular-nums">
                        {value}
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </Panel>

          <Panel title="Product">
            {product ? (
              <div className="space-y-2 px-5 py-4 text-[13.5px]">
                <p className="font-bold text-ink">{product.name}</p>
                <p className="font-mono text-ink-soft">SKU {product.sku}</p>
                <p className="flex justify-between">
                  <span className="text-ink-soft">Price</span>
                  <span className="font-mono font-bold tabular-nums">
                    {formatINR(product.priceInPaise)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-ink-soft">In stock</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      lowStock ? "text-chili" : "text-ink"
                    }`}
                  >
                    {product.inventoryQuantity}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-ink-soft">Storefront</span>
                  <span className="font-bold">
                    {product.active ? "Active" : "Hidden"}
                  </span>
                </p>
              </div>
            ) : (
              <p className="px-5 py-6 text-center text-[13.5px] text-ink-soft">
                No product row found. Run <code>npm run db:seed</code>.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
