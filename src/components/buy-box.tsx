"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  HandCoins,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Timer,
  Truck,
  Undo2,
  Zap,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { STOCK_LABELS } from "@/lib/product-types";
import { buttonClasses, TrustChip } from "./ui";
import { useCart } from "./cart-store";

/**
 * The hero purchase block. Its one job is to make the buying decision
 * immediate: price, a dominant Buy-now action, quantity + cart as secondary
 * actions, and every trust reassurance sitting directly under the buttons.
 *
 * `promiseLine` (dispatch/delivery window) comes from the server page so the
 * client bundle never needs `@/lib/config` — policy copy has a single source.
 */
export function BuyBox({ promiseLine }: { promiseLine?: string }) {
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
        <p className="font-display text-[2.6rem] font-medium leading-none tracking-tight text-ink">
          {product.priceInPaise > 0 ? formatINR(product.priceInPaise) : "—"}
          {product.priceInPaise > 0 ? (
            <span className="ml-2 font-sans text-sm font-medium text-ink-faint">online</span>
          ) : null}
        </p>
        <p className="inline-flex rounded-full bg-chili-soft px-4 py-2 text-sm font-bold text-chili">
          {STOCK_LABELS[product.stockState]}
        </p>
        <p className="text-sm font-medium text-ink-soft">
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
      {/* Price — the instant answer to "how much?" */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-display text-[2.6rem] font-medium leading-none tracking-tight text-ink">
            {formatINR(product.priceInPaise)}
          </p>
          <p className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-bold text-leaf">
            Online price · taxes included
          </p>
        </div>
        {/*
          The Cash-on-Delivery price is deliberately NOT repeated here. It is
          still shown where it becomes a decision — the cart, the checkout
          payment selector and the pricing block further down this page — so
          nothing about the COD total is hidden from the buyer.
        */}
        <p className="mt-1.5 text-sm font-medium text-ink-faint">
          {product.shippingInPaise === 0
            ? "Free doorstep delivery across India"
            : `${formatINR(product.shippingInPaise)} shipping`}
          {product.stockState === "low_stock" ? (
            <span className="font-bold text-haldi">
              {" "}
              · only {product.availableQuantity} left
            </span>
          ) : null}
        </p>
      </div>

      {/* The sticky mobile bar appears once this block scrolls out of view */}
      <div id="hero-cta" className="space-y-3">
        {/* Primary purchase action — full width, impossible to miss */}
        <button
          type="button"
          onClick={buyNow}
          className={buttonClasses({
            size: "xl",
            className: "btn-glow w-full",
          })}
        >
          <Zap className="size-5" aria-hidden />
          Buy now — {formatINR(product.priceInPaise)}
        </button>
        {/* Secondary actions share one quieter row */}
        <div className="flex items-center gap-3">
          <div
            className="inline-flex shrink-0 items-center rounded-full border-[1.5px] border-sandline bg-white"
            role="group"
            aria-label="Quantity"
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
              className="w-7 text-center font-mono text-base font-bold tabular-nums"
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
          <button
            type="button"
            onClick={() => add(qty)}
            className={buttonClasses({
              variant: "secondary",
              size: "lg",
              className: "flex-1",
            })}
          >
            <ShoppingBag className="size-4.5" aria-hidden />
            Add to cart
          </button>
        </div>
      </div>

      {/* Trust, exactly where the decision happens */}
      <div className="space-y-2.5 rounded-2xl border border-dashed border-sandline bg-white/70 px-4 py-3.5">
        {promiseLine ? (
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <Timer className="size-4 shrink-0 text-accent-deep" aria-hidden />
            {promiseLine}
          </p>
        ) : null}
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <TrustChip icon={<Truck />}>Free shipping</TrustChip>
          <TrustChip icon={<HandCoins />}>COD available</TrustChip>
          <TrustChip icon={<Undo2 />}>7-day replacement</TrustChip>
          <TrustChip icon={<ShieldCheck />}>Secure checkout</TrustChip>
        </ul>
      </div>
    </div>
  );
}
