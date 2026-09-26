import { desc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  DefinitionList,
  Note,
  PageHeader,
  Panel,
} from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/catalog-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product" };

export default async function AdminProductPage() {
  const admin = await requirePermissionPage("product.view");
  const [product] = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(1);

  if (!product) {
    return (
      <>
        <PageHeader title="Product" />
        <Note tone="warn">
          No product row exists yet. Run <code>npm run db:seed</code> once to
          create the Beevo Go catalogue entry, then refresh this page.
        </Note>
      </>
    );
  }

  const canEdit = roleHasPermission(admin.role, "product.update");

  return (
    <>
      <PageHeader
        title="Product"
        subtitle="The single source of truth for pricing, stock limits and storefront copy."
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title={product.name}>
          {canEdit ? (
            <ProductForm
              product={product}
              canEditPrice={roleHasPermission(admin.role, "product.update_price")}
            />
          ) : (
            <div className="px-5 py-5">
              <Note>Your role can view the product but not edit it.</Note>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Current values">
            <DefinitionList
              items={[
                { label: "SKU", value: product.sku },
                { label: "Price", value: formatINR(product.priceInPaise) },
                {
                  label: "Shipping",
                  value:
                    product.shippingInPaise === 0
                      ? "Free"
                      : formatINR(product.shippingInPaise),
                },
                { label: "Stock on hand", value: product.inventoryQuantity },
                { label: "Low-stock alert", value: product.lowStockThreshold },
                { label: "Max per order", value: product.maxPerOrder },
                {
                  label: "Storefront",
                  value: product.active ? "Active" : "Hidden",
                },
                { label: "Updated", value: formatDateTime(product.updatedAt) },
              ]}
            />
          </Panel>

          <Panel title="How pricing works">
            <div className="space-y-2 px-5 py-4 text-[13px] font-semibold text-ink-soft">
              <p>
                Checkout never trusts the price sent by the browser — it reads
                this row from the database and recalculates the total in paise.
              </p>
              <p>
                Existing orders keep the price they were placed at, because each
                order stores its own snapshot.
              </p>
              <p>
                Product images and marketing copy live in the codebase; edit them
                in <code>src/lib/content.ts</code> and deploy.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
