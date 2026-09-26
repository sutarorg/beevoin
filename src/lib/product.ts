import "server-only";
import { asc, eq } from "drizzle-orm";
import { unstable_cache, updateTag } from "next/cache";
import { db } from "@/db";
import { products, type Product } from "@/db/schema";
import { PRIMARY_PRODUCT_SLUG } from "./config";
import { toProductView, type ProductView } from "./product-view";

/**
 * Product reads.
 *
 * - Storefront pages use the cached read so a visitor never triggers an
 *   uncached database round-trip (revalidated every 5 minutes, and
 *   invalidated immediately whenever an admin saves the product).
 * - Checkout and every admin mutation use the uncached read: money and stock
 *   decisions must always see current data.
 */

export const PRODUCT_TAG = "beevo-product";

/** Uncached, authoritative read. Use for checkout, payments and admin. */
export async function getPrimaryProduct(): Promise<Product | undefined> {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.slug, PRIMARY_PRODUCT_SLUG))
    .limit(1);
  if (row) return row;
  // Fall back to the first catalogue row so a renamed slug can't break the store.
  const [first] = await db
    .select()
    .from(products)
    .orderBy(asc(products.createdAt))
    .limit(1);
  return first;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row;
}

async function readStorefrontProduct(): Promise<ProductView | null> {
  const product = await getPrimaryProduct();
  return product ? toProductView(product) : null;
}

const cachedStorefrontProduct = unstable_cache(
  readStorefrontProduct,
  ["beevo-storefront-product"],
  { revalidate: 300, tags: [PRODUCT_TAG] },
);

/** Cached product projection for storefront rendering. */
export function getStorefrontProduct(): Promise<ProductView | null> {
  return cachedStorefrontProduct();
}

/** Call after any admin write so shoppers see the change immediately. */
export function invalidateProductCache(): void {
  updateTag(PRODUCT_TAG);
}
