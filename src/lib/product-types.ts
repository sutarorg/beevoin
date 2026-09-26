/**
 * Client-safe product shapes.
 *
 * The storefront renders the authoritative database product, so these types
 * must be importable from client components. Keep this module free of any
 * server-only import (no `@/db`, no `server-only`).
 */

export type StockState = "in_stock" | "low_stock" | "out_of_stock" | "inactive";

export type ProductImage = { src: string; alt: string };
export type ProductSpecification = { label: string; value: string };

export type StorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  sku: string;
  description: string;
  shortDescription: string;
  /** Integer paise — never a float. */
  priceInPaise: number;
  currency: string;
  maxPerOrder: number;
  shippingInPaise: number;
  active: boolean;
  images: ProductImage[];
  specifications: ProductSpecification[];
  metaTitle: string | null;
  metaDescription: string | null;
  stockState: StockState;
  purchasable: boolean;
  /** Units a customer may actually add right now. */
  availableQuantity: number;
};

export const STOCK_LABELS: Record<StockState, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  inactive: "Inactive",
};

/**
 * Fallback used ONLY when the database is unreachable or unseeded, so the
 * marketing page can still render copy. It is deliberately NOT purchasable:
 * a price is never invented, and checkout always re-reads the database.
 */
export const UNAVAILABLE_PRODUCT: StorefrontProduct = {
  id: "",
  slug: "beevo-go",
  name: "Beevo Go Mini Thermal Printer",
  shortName: "Beevo Go",
  sku: "BG-GO-01",
  description: "",
  shortDescription: "",
  priceInPaise: 0,
  currency: "INR",
  maxPerOrder: 1,
  shippingInPaise: 0,
  active: false,
  images: [
    {
      src: "/images/product-1.jpg",
      alt: "Beevo Go mini thermal printer",
    },
  ],
  specifications: [],
  metaTitle: null,
  metaDescription: null,
  stockState: "inactive",
  purchasable: false,
  availableQuantity: 0,
};
