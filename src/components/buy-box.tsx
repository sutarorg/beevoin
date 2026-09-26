"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck,
  Flame,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
  Undo2,
  Zap,
} from "lucide-react";
import { SOCIAL_PROOF } from "@/lib/content";
import { formatINR } from "@/lib/format";
import { STOCK_LABELS } from "@/lib/product-types";
import { buttonClasses, StarRating, TrustChip } from "./ui";
import { useCart } from "./cart-store";

export function BuyBox() {
  const router = useRouter();
  const { add, setQty, product, maxPerOrder } = useCart();
  const [qty, setLocalQty] = useState(1);

  const buyNow = () => {
    setQty(qty);
    router.push("/checkout");
  };

  /** How much cheaper paying online is vs Cash on Delivery. */
  const codSaving = product.codPriceInPaise - product.priceInPaise;
  /** Scarcity is only ever shown when the database says stock is low. */
  const lowStock = product.stockState === "low_stock";

  // Stock/pricing come from the database via the server layout. When the
  // product is unavailable we never invent a price or let the buyer proceed.
  if (!product.purchasable) {
    return (
      <div
        className="min-w-0 space-y-4 rounded-[2rem] border border-sandline/80 bg-white/85 p-5 shadow-pop backdrop-blur"
        data-testid="buy-box"
      >
        <p className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.04em] text-ink">
          {product.priceInPaise > 0 ? formatINR(product.priceInPaise) : "—"}
          {product.priceInPaise > 0 ? (
            <span className="ml-2 font-sans text-sm font-semibold text-ink-faint">online</span>
          ) : null}
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
          <TrustChip icon={<Smartphone />}>Works with iPhone & Android</TrustChip>
          <TrustChip icon={<Undo2 />}>7-day replacement</TrustChip>
          <TrustChip icon={<ShieldCheck />}>Secure checkout</TrustChip>
        </ul>
      </div>
    );
  }

  return (
    <div
      className="min-w-0 space-y-5 rounded-[2rem] border border-sandline/80 bg-white/85 p-4 shadow-pop backdrop-blur sm:p-5"
      data-testid="buy-box"
    >
      {/* Price — online price first, with the COD comparison right beside it
          so the prepaid-vs-COD decision happens at the point of purchase,
          not half a page later. */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="font-display text-[2.2rem] font-extrabold leading-none tracking-[-0.04em] text-ink">
            {formatINR(product.priceInPaise)}
            <span className="ml-2 align-middle font-sans text-sm font-bold text-leaf">online</span>
          </p>
          {codSaving > 0 ? (
            <>
              <p className="text-[15px] font-bold text-ink-faint">
                {formatINR(product.codPriceInPaise)} on COD
              </p>
              <span className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-bold text-leaf">
                Save {formatINR(codSaving)} by paying online
              </span>
            </>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-ink-faint">
          Inclusive of all taxes ·{" "}
          {product.shippingInPaise === 0
            ? "Free shipping"
            : `${formatINR(product.shippingInPaise)} shipping`}
          {codSaving > 0 ? " · COD available" : ""}
        </p>
        {/* Social proof directly under the price — see the SOCIAL_PROOF
            warning in lib/content.ts: replace with real review data. */}
        {SOCIAL_PROOF.reviewCount > 0 ? (
          <a
            href="#reviews"
            className="inline-flex items-center gap-2.5 rounded-full bg-cream/70 px-3 py-1.5 transition-opacity hover:opacity-80"
          >
            <StarRating rating={SOCIAL_PROOF.rating} />
            <span className="text-[13.5px] font-bold text-ink-soft">
              {SOCIAL_PROOF.rating.toFixed(1)} · {SOCIAL_PROOF.reviewCount} reviews
            </span>
            <span className="text-[13.5px] font-bold text-accent-deep" aria-hidden>
              ↓
            </span>
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream/65 p-2.5">
        <span className="pl-1 text-sm font-bold text-ink-soft" id="qty-label">
          Qty
        </span>
        <div
          className="inline-flex items-center rounded-full border-[1.5px] border-sandline bg-white shadow-[0_1px_0_rgb(255_255_255/0.85)]"
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

      {/* Scarcity lives with the CTA, not in the small print — but only when
          the database genuinely reports low stock. */}
      {lowStock ? (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-chili-soft px-3.5 py-1.5 text-[13px] font-bold text-chili">
          <Flame className="size-4" aria-hidden />
          Only {product.availableQuantity} left in stock
        </p>
      ) : null}

      {/* The sticky mobile bar appears once this block scrolls out of view.
          One dominant action: Buy now. Add to cart is deliberately demoted to
          a quiet secondary — this is a single-SKU store, the job of the hero
          is to get the buyer to checkout. */}
      <div id="hero-cta" className="space-y-1.5">
        <button
          type="button"
          onClick={buyNow}
          className={buttonClasses({ size: "lg", className: "w-full" })}
        >
          <Zap className="size-4.5" aria-hidden />
          Buy now — {formatINR(product.priceInPaise)} online
        </button>
        <button
          type="button"
          onClick={() => add(qty)}
          className={buttonClasses({
            variant: "ghost",
            size: "md",
            className: "w-full",
          })}
        >
          <ShoppingBag className="size-4" aria-hidden />
          Add to cart
        </button>
      </div>

      {/* The three highest-anxiety pre-purchase objections, answered right at
          the buy button — previously buried in the FAQ and spec table. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        <TrustChip icon={<Smartphone />}>Works with iPhone & Android</TrustChip>
        <TrustChip icon={<BadgeCheck />}>No ink or subscription, ever</TrustChip>
        <TrustChip icon={<Undo2 />}>7-day replacement</TrustChip>
        <TrustChip icon={<Truck />}>Free shipping</TrustChip>
      </ul>
    </div>
  );
}
