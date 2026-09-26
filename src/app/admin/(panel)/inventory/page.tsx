import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { listInventoryEvents } from "@/lib/admin/queries";
import { INVENTORY_REASON_LABELS } from "@/lib/services/inventory";
import { stockStateOf, STOCK_LABELS } from "@/lib/services/products";
import { formatDateTime } from "@/lib/format";
import { InventoryForm } from "@/components/admin/settings-forms";
import {
  EmptyRow,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inventory" };

/**
 * Inventory.
 *
 * Stock is never edited as a raw number: every change is a delta applied in a
 * conditional UPDATE inside a transaction, which is what makes overselling
 * impossible under concurrent checkouts. The ledger below is the full history.
 */
export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermission("inventory.view");
  const params = await searchParams;

  const [[product], events] = await Promise.all([
    db.select().from(products).orderBy(asc(products.createdAt)).limit(1),
    listInventoryEvents({ page: params.page }),
  ]);

  if (!product) {
    return (
      <>
        <PageHeader title="Inventory" />
        <Notice tone="error">
          No product row exists yet. Run <code>npm run db:seed</code> first.
        </Notice>
      </>
    );
  }

  const stock = stockStateOf(product);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock is adjusted by deltas, never by overwriting a number. Each movement is recorded with a reason and the admin who made it."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Units in stock"
          value={String(product.inventoryQuantity)}
          hint={STOCK_LABELS[stock]}
        />
        <StatCard
          label="Low-stock threshold"
          value={String(product.lowStockThreshold)}
          hint="Alerts below this level"
        />
        <StatCard
          label="Max per order"
          value={String(product.maxPerOrder)}
          hint="Enforced server-side at checkout"
        />
      </div>

      {stock === "out_of_stock" ? (
        <div className="mt-5">
          <Notice tone="error">
            The product is out of stock. The storefront is showing it as
            unavailable and checkout will refuse new orders.
          </Notice>
        </div>
      ) : stock === "low_stock" ? (
        <div className="mt-5">
          <Notice tone="warning">
            Stock is at or below the low-stock threshold.
          </Notice>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Adjust stock">
          {roleHasPermission(actor.role, "inventory.adjust") ? (
            <InventoryForm
              productId={product.id}
              currentQuantity={product.inventoryQuantity}
            />
          ) : (
            <p className="px-5 py-5 text-[13.5px] text-ink-soft">
              Your role can view stock but not adjust it.
            </p>
          )}
        </Panel>

        <Panel title="Stock ledger">
          <Table>
            <thead>
              <tr>
                <Th>Change</Th>
                <Th>After</Th>
                <Th>Reason</Th>
                <Th>Order</Th>
                <Th>By</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {events.rows.length === 0 ? (
                <EmptyRow colSpan={6}>No stock movements recorded yet.</EmptyRow>
              ) : (
                events.rows.map((event) => (
                  <tr key={event.id}>
                    <Td
                      className={`font-mono font-bold tabular-nums ${
                        event.quantityChange < 0 ? "text-chili" : "text-leaf"
                      }`}
                    >
                      {event.quantityChange > 0 ? "+" : ""}
                      {event.quantityChange}
                    </Td>
                    <Td className="font-mono tabular-nums">
                      {event.quantityAfter}
                    </Td>
                    <Td>
                      {INVENTORY_REASON_LABELS[event.reason] ?? event.reason}
                      {event.note ? (
                        <span className="block text-[12.5px] text-ink-soft">
                          {event.note}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-[12.5px] text-ink-soft">
                      {event.orderNumber ?? "—"}
                    </Td>
                    <Td className="text-ink-soft">
                      {event.actorEmail ?? "system"}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">
                      {formatDateTime(event.createdAt)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <Pagination
            page={events.page}
            pageCount={events.pageCount}
            total={events.total}
            basePath="/admin/inventory"
            params={params}
          />
        </Panel>
      </div>
    </>
  );
}
