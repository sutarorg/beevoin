"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  HandCoins,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
  Zap,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { STOCK_LABELS } from "@/lib/product-types";
import { buttonClasses, TrustChip } from "./ui";
import { useCart } from "./cart-store";

export function BuyBox() {
  const router = useRouter();
  const { add, setQty, product, maxPerOrder } = useCart();
  const [qty, setLocalQty] = useState(1);

  const buyNow = () => {
    setQty(qty);
    router.push("/checkout");
  };

  // Stock/pricing come from the database via the server layout. When the
  // product is unavailable we never invent a price or let the buyer proceed.
  if (!product.purchasable) {
    return (
      <div className="min-w-0 space-y-4" data-testid="buy-box">
        <p className="font-display text-[2.1rem] font-bold leading-none tracking-tight text-ink">
          {product.priceInPaise > 0 ? formatINR(product.priceInPaise) : "—"}
        </p>
        <p className="inline-flex rounded-full bg-chili-soft px-4 py-2 text-sm font-bold text-chili">
          {STOCK_LABELS[product.stockState]}
        </p>
        <p className="text-sm font-semibold text-ink-soft">
          {product.stockState === "out_of_stock"
            ? "We've sold out for now. Check back shortly — restocks are frequent."
            : "This product isn't available for purchase right now."}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          <TrustChip icon={<Truck />}>Free shipping</TrustChip>
          <TrustChip icon={<HandCoins />}>COD available</TrustChip>
          <TrustChip icon={<Undo2 />}>7-day replacement</TrustChip>
          <TrustChip icon={<ShieldCheck />}>Secure checkout</TrustChip>
        </ul>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5" data-testid="buy-box">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="font-display text-[2.1rem] font-bold leading-none tracking-tight text-ink">
          {formatINR(product.priceInPaise)}
        </p>
        <p className="pb-1 text-sm font-semibold text-ink-faint">
          Inclusive of all taxes ·{" "}
          {product.shippingInPaise === 0
            ? "Free shipping"
            : `${formatINR(product.shippingInPaise)} shipping`}
        </p>
        {product.stockState === "low_stock" ? (
          <p className="pb-1 text-sm font-bold text-haldi">
            Only {product.availableQuantity} left
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-ink-soft" id="qty-label">
          Qty
        </span>
        <div
          className="inline-flex items-center rounded-full border-[1.5px] border-sandline bg-white"
          role="group"
          aria-labelledby="qty-label"
        >
          <button
            type="button"
            onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            className="p-3 text-ink transition disabled:opacity-30"
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span
            className="w-8 text-center font-mono text-base font-bold tabular-nums"
            aria-live="polite"
          >
            {qty}
          </span>
          <button
            type="button"
            onClick={() =>
              setLocalQty((q) => Math.min(maxPerOrder, q + 1))
            }
            disabled={qty >= maxPerOrder}
            className="p-3 text-ink transition disabled:opacity-30"
            aria-label="Increase quantity"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <span className="text-xs font-semibold text-ink-faint">
          Max {maxPerOrder} per order
        </span>
      </div>

      {/* The sticky mobile bar appears once this block scrolls out of view */}
      <div id="hero-cta" className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={buyNow}
          className={buttonClasses({ size: "lg" })}
        >
          <Zap className="size-4.5" aria-hidden />
          Buy now — {formatINR(product.priceInPaise)}
        </button>
        <button
          type="button"
          onClick={() => add(qty)}
          className={buttonClasses({ variant: "secondary", size: "lg" })}
        >
          <ShoppingBag className="size-4.5" aria-hidden />
          Add to cart
        </button>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        <TrustChip icon={<Truck />}>Free shipping</TrustChip>
        <TrustChip icon={<HandCoins />}>COD available</TrustChip>
        <TrustChip icon={<Undo2 />}>7-day replacement</TrustChip>
        <TrustChip icon={<ShieldCheck />}>Secure checkout</TrustChip>
      </ul>
    </div>
  );
}
