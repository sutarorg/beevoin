import "server-only";

import { asc, eq } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/db";
import { products, type Product } from "@/db/schema";
import type { StockState, StorefrontProduct } from "@/lib/product-types";

/**
 * Product reads.
 *
 * Two deliberately different paths:
 *
 *   • getStorefrontProduct()  — cached. Marketing pages must not run an
 *     uncached query for every visitor. Revalidated on any admin product
 *     mutation via the `product` cache tag.
 *
 *   • getCheckoutProduct()    — never cached. Checkout, payment verification
 *     and inventory always read authoritative current data.
 */

export type { StockState, StorefrontProduct } from "@/lib/product-types";
export { STOCK_LABELS } from "@/lib/product-types";

export const PRODUCT_CACHE_TAG = "product";

export function stockStateOf(product: {
  active: boolean;
  inventoryQuantity: number;
  lowStockThreshold: number;
}): StockState {
  if (!product.active) return "inactive";
  if (product.inventoryQuantity <= 0) return "out_of_stock";
  if (product.inventoryQuantity <= product.lowStockThreshold) return "low_stock";
  return "in_stock";
}

function toStorefront(product: Product): StorefrontProduct {
  const stockState = stockStateOf(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortName: product.shortName,
    sku: product.sku,
    description: product.description,
    shortDescription: product.shortDescription,
    priceInPaise: product.priceInPaise,
    currency: product.currency,
    maxPerOrder: product.maxPerOrder,
    shippingInPaise: product.shippingInPaise,
    active: product.active,
    images: product.images ?? [],
    specifications: product.specifications ?? [],
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    stockState,
    purchasable: stockState === "in_stock" || stockState === "low_stock",
    availableQuantity: Math.max(
      0,
      Math.min(product.maxPerOrder, product.inventoryQuantity),
    ),
  };
}

/** Uncached authoritative read — the only source checkout is allowed to use. */
export async function getCheckoutProduct(): Promise<Product | undefined> {
  const [row] = await db
    .select()
    .from(products)
    .orderBy(asc(products.createdAt))
    .limit(1);
  return row;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row;
}

const loadStorefrontProduct = unstable_cache(
  async (): Promise<StorefrontProduct | null> => {
    const row = await getCheckoutProduct();
    return row ? toStorefront(row) : null;
  },
  ["beevo:storefront-product"],
  { tags: [PRODUCT_CACHE_TAG], revalidate: 60 },
);

/**
 * Cached storefront read. Returns `null` only when the database has not been
 * seeded — callers render a "temporarily unavailable" state rather than
 * inventing a price.
 */
export async function getStorefrontProduct(): Promise<StorefrontProduct | null> {
  try {
    return await loadStorefrontProduct();
  } catch {
    return null;
  }
}

/**
 * Drop the cached storefront product. Called after every admin mutation so a
 * price/stock/content change is visible immediately instead of after the
 * 60-second window. Next 16 requires an explicit cache-life profile.
 */
export function invalidateProductCache(): void {
  revalidateTag(PRODUCT_CACHE_TAG, "max");
}

export function toStorefrontProduct(product: Product): StorefrontProduct {
  return toStorefront(product);
}
