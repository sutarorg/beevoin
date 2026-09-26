import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, type OrderStatus } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { ORDER_STATUSES, STATUS_META } from "@/lib/order-status";
import { formatDateTime, formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const toneByStatus: Partial<Record<OrderStatus, string>> = {
  pending: "bg-haldi-soft text-haldi",
  confirmed: "bg-accent-soft text-accent-deep",
  processing: "bg-accent-soft text-accent-deep",
  shipped: "bg-cream text-ink-soft",
  out_for_delivery: "bg-cream text-ink-soft",
  delivered: "bg-leaf-soft text-leaf",
  cancelled: "bg-chili-soft text-chili",
  refunded: "bg-chili-soft text-chili",
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { status } = await searchParams;
  const filter = (ORDER_STATUSES as string[]).includes(status ?? "")
    ? (status as OrderStatus)
    : null;

  const [rows, kpis] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200),
    db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(case when payment_status = 'paid' or (payment_method = 'cod' and status = 'delivered') then total_in_paise else 0 end), 0)::int`,
        toShip: sql<number>`count(*) filter (where status in ('confirmed','processing'))::int`,
        today: sql<number>`count(*) filter (where created_at::date = (now() at time zone 'Asia/Kolkata')::date)::int`,
      })
      .from(orders)
      .then((r) => r[0]),
  ]);

  const visible = filter ? rows.filter((o) => o.status === filter) : rows;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          Orders
        </h1>
        <p className="text-sm font-semibold text-ink-faint">
          Latest 200 orders · times in IST
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Orders today", value: String(kpis?.today ?? 0) },
          { label: "Total orders", value: String(kpis?.totalOrders ?? 0) },
          { label: "To pack / ship", value: String(kpis?.toShip ?? 0) },
          {
            label: "Collected revenue",
            value: formatINR(kpis?.revenue ?? 0),
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-sandline bg-card p-5"
          >
            <p className="text-[12px] font-extrabold uppercase tracking-wider text-ink-faint">
              {kpi.label}
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-ink">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin"
          className={cn(
            "rounded-full px-4 py-2 text-[13px] font-bold",
            !filter ? "bg-ink text-paper" : "bg-card text-ink-soft hover:bg-cream",
          )}
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-bold",
              filter === s
                ? "bg-ink text-paper"
                : "bg-card text-ink-soft hover:bg-cream",
            )}
          >
            {STATUS_META[s].label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sandline bg-card p-12 text-center">
          <p className="font-bold text-ink">No orders here yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            {filter
              ? "Try a different filter."
              : "Orders will appear here as soon as customers start checking out."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sandline bg-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-sandline text-[11.5px] uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-3.5 font-extrabold">Order</th>
                <th className="px-5 py-3.5 font-extrabold">Customer</th>
                <th className="px-5 py-3.5 font-extrabold">City</th>
                <th className="px-5 py-3.5 font-extrabold">Total</th>
                <th className="px-5 py-3.5 font-extrabold">Payment</th>
                <th className="px-5 py-3.5 font-extrabold">Status</th>
                <th className="px-5 py-3.5 font-extrabold">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sandline/60">
              {visible.map((order) => (
                <tr key={order.id} className="hover:bg-cream/40">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono font-bold text-accent-deep hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-[11.5px] font-semibold text-ink-faint">
                      ×{order.quantity} {order.productSku}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-ink">{order.customerName}</p>
                    <p className="text-[12px] font-semibold text-ink-faint">
                      {order.phone}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-ink-soft">
                    {order.city}
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold tabular-nums">
                    {formatINR(order.totalInPaise)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-ink">
                      {order.paymentMethod === "cod" ? "COD" : "Online"}
                    </span>
                    <p
                      className={cn(
                        "text-[11.5px] font-bold",
                        order.paymentStatus === "paid"
                          ? "text-leaf"
                          : "text-haldi",
                      )}
                    >
                      {order.paymentStatus}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11.5px] font-extrabold",
                        toneByStatus[order.status],
                      )}
                    >
                      {STATUS_META[order.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] font-semibold text-ink-soft">
                    {formatDateTime(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
