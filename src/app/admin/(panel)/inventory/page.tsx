import { desc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { inventoryTotals, recentInventoryEvents } from "@/lib/inventory";
import { formatDateTime } from "@/lib/format";
import {
  EmptyRow,
  Note,
  PageHeader,
  Panel,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { InventoryForm } from "@/components/admin/catalog-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory" };

const REASON_LABEL: Record<string, string> = {
  order_reserved: "Order placed",
  order_cancelled: "Order cancelled / released",
  restock: "Restock",
  manual_adjustment: "Manual adjustment",
  initial_stock: "Initial stock",
  refund: "Refund restock",
};

export default async function AdminInventoryPage() {
  const admin = await requirePermissionPage("inventory.view");
  const [product] = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(1);

  if (!product) {
    return (
      <>
        <PageHeader title="Inventory" />
        <Note tone="warn">
          No product row exists yet. Run <code>npm run db:seed</code> to create
          it.
        </Note>
      </>
    );
  }

  const [events, totals] = await Promise.all([
    recentInventoryEvents(product.id, 60),
    inventoryTotals(product.id),
  ]);

  const canAdjust = roleHasPermission(admin.role, "inventory.adjust");
  const lowStock = product.inventoryQuantity <= product.lowStockThreshold;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${product.name} · ${product.sku}`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="On hand"
          value={product.inventoryQuantity}
          hint={lowStock ? "At or below the alert level" : "Healthy"}
          tone={lowStock ? "warn" : "accent"}
        />
        <StatCard
          label="Sold (reserved)"
          value={totals.sold}
          hint="Units committed to orders"
        />
        <StatCard
          label="Returned to stock"
          value={totals.returned}
          hint="Cancellations and refunds"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        <Panel title="Adjust stock">
          {canAdjust ? (
            <InventoryForm
              productId={product.id}
              currentQuantity={product.inventoryQuantity}
            />
          ) : (
            <div className="px-5 py-5">
              <Note>Your role can view stock but not change it.</Note>
            </div>
          )}
        </Panel>

        <Panel
          title="Stock ledger"
          description="Every movement, in order. Nothing here can be edited or deleted."
        >
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Reason</Th>
                <Th className="text-right">Change</Th>
                <Th className="text-right">After</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <EmptyRow colSpan={5}>No stock movements recorded yet.</EmptyRow>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <Td>{formatDateTime(event.createdAt)}</Td>
                    <Td>{REASON_LABEL[event.reason] ?? event.reason}</Td>
                    <Td
                      className={`text-right font-extrabold ${
                        event.quantityChange < 0 ? "text-chili" : "text-leaf"
                      }`}
                    >
                      {event.quantityChange > 0 ? "+" : ""}
                      {event.quantityChange}
                    </Td>
                    <Td className="text-right">{event.quantityAfter}</Td>
                    <Td>{event.note ?? "—"}</Td>
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
