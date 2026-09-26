import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { stockStateOf, STOCK_LABELS } from "@/lib/services/products";
import { formatDateTime, formatINR } from "@/lib/format";
import { PriceForm, ProductForm } from "@/components/admin/settings-forms";
import {
  Notice,
  PageHeader,
  Panel,
  Pill,
  StatCard,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Product" };

/**
 * The single product.
 *
 * This page edits the authoritative `products` row — the same row the
 * storefront renders and checkout validates against. Price lives in its own
 * form behind its own permission so a routine copy edit can never move money.
 */
export default async function AdminProductPage() {
  const actor = await requirePermission("product.view");

  const [product] = await db
    .select()
    .from(products)
    .orderBy(asc(products.createdAt))
    .limit(1);

  if (!product) {
    return (
      <>
        <PageHeader title="Product" />
        <Notice tone="error">
          No product row exists yet. Run <code>npm run db:seed</code> to create
          the Beevo Go product, then reload this page.
        </Notice>
      </>
    );
  }

  const stock = stockStateOf(product);
  const canEdit = roleHasPermission(actor.role, "product.update");
  const canPrice = roleHasPermission(actor.role, "product.update_price");

  return (
    <>
      <PageHeader
        title="Product"
        description="The database is the source of truth for price, stock, availability and limits. The storefront reads a 60-second cache; checkout always re-reads this row."
        actions={
          <Link
            href="/"
            className="text-[13px] font-bold text-ink-soft hover:text-ink"
          >
            View on storefront →
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Price" value={formatINR(product.priceInPaise)} />
        <StatCard
          label="Shipping"
          value={
            product.shippingInPaise === 0
              ? "Free"
              : formatINR(product.shippingInPaise)
          }
        />
        <StatCard
          label="In stock"
          value={String(product.inventoryQuantity)}
          hint={STOCK_LABELS[stock]}
          href="/admin/inventory"
        />
        <StatCard
          label="Last updated"
          value={formatDateTime(product.updatedAt).split(",")[0]}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Product details">
          {canEdit ? (
            <ProductForm
              product={{
                id: product.id,
                name: product.name,
                shortName: product.shortName,
                sku: product.sku,
                shortDescription: product.shortDescription,
                description: product.description,
                active: product.active,
                maxPerOrder: product.maxPerOrder,
                lowStockThreshold: product.lowStockThreshold,
                metaTitle: product.metaTitle ?? "",
                metaDescription: product.metaDescription ?? "",
                specificationsText: product.specifications
                  .map((spec) => `${spec.label} | ${spec.value}`)
                  .join("\n"),
                imagesText: product.images
                  .map((image) => `${image.src} | ${image.alt}`)
                  .join("\n"),
              }}
            />
          ) : (
            <p className="px-5 py-5 text-[13.5px] text-ink-soft">
              Your role can view the product but not edit it.
            </p>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Price & shipping">
            {canPrice ? (
              <PriceForm
                productId={product.id}
                priceInPaise={product.priceInPaise}
                shippingInPaise={product.shippingInPaise}
              />
            ) : (
              <div className="space-y-2 px-5 py-5 text-[13.5px] text-ink-soft">
                <p>
                  Price changes are restricted to owner and admin roles and are
                  always audit-logged.
                </p>
                <p className="font-mono font-bold text-ink">
                  {formatINR(product.priceInPaise)}
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Storefront status">
            <div className="space-y-2.5 px-5 py-4 text-[13.5px]">
              <p className="flex items-center justify-between">
                <span className="text-ink-soft">Selling</span>
                <Pill tone={product.active ? "green" : "red"}>
                  {product.active ? "Active" : "Hidden"}
                </Pill>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-ink-soft">Stock state</span>
                <Pill
                  tone={
                    stock === "in_stock"
                      ? "green"
                      : stock === "low_stock"
                        ? "amber"
                        : "red"
                  }
                >
                  {STOCK_LABELS[stock]}
                </Pill>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-ink-soft">Max per order</span>
                <span className="font-mono font-bold">
                  {product.maxPerOrder}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-ink-soft">Currency</span>
                <span className="font-mono font-bold">{product.currency}</span>
              </p>
            </div>
          </Panel>

          <Panel title="Images on file">
            <ul className="divide-y divide-sandline/70">
              {product.images.map((image) => (
                <li key={image.src} className="px-5 py-2.5 text-[13px]">
                  <span className="block font-mono text-ink">{image.src}</span>
                  <span className="block text-[12.5px] text-ink-soft">
                    {image.alt}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
