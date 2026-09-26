import type { Product, ProductImage, ProductSpecification } from "@/db/schema";

/**
 * Client-safe projection of the catalogue row. Client components receive this
 * (never the raw database row) so nothing internal leaks into the bundle.
 */

export const stockStates = [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "inactive",
] as const;
export type StockState = (typeof stockStates)[number];

export type ProductView = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  sku: string;
  description: string;
  shortDescription: string;
  priceInPaise: number;
  currency: string;
  maxPerOrder: number;
  shippingInPaise: number;
  inventoryQuantity: number;
  lowStockThreshold: number;
  stockState: StockState;
  /** True when a customer may place an order right now. */
  purchasable: boolean;
  /** Highest quantity a customer may put in the cart right now. */
  maxOrderableQuantity: number;
  images: ProductImage[];
  specifications: ProductSpecification[];
};

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

export const STOCK_LABEL: Record<StockState, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  inactive: "Not available",
};

export function toProductView(product: Product): ProductView {
  const stockState = stockStateOf(product);
  const purchasable = stockState === "in_stock" || stockState === "low_stock";
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
    inventoryQuantity: product.inventoryQuantity,
    lowStockThreshold: product.lowStockThreshold,
    stockState,
    purchasable,
    maxOrderableQuantity: purchasable
      ? Math.max(1, Math.min(product.maxPerOrder, product.inventoryQuantity))
      : 0,
    images: product.images ?? [],
    specifications: product.specifications ?? [],
  };
}

/** Order total, computed from authoritative values only. Integer paise. */
export function orderTotalInPaise(input: {
  unitPriceInPaise: number;
  quantity: number;
  shippingInPaise: number;
}): number {
  return input.unitPriceInPaise * input.quantity + input.shippingInPaise;
}
