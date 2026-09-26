"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { useCart } from "./cart-store";

/**
 * Mobile sticky purchase bar — appears only after the hero buy-box scrolls
 * out of view, and hides when the buy-box (or footer) is visible so it never
 * overlaps primary actions.
 */
export function StickyBuyBar() {
  const router = useRouter();
  const { setQty, product } = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById("hero-cta");
    if (!anchor || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  const buyNow = () => {
    setQty(1);
    router.push("/checkout");
  };

  if (!product.purchasable) return null;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-sandline bg-white/95 shadow-[0_-8px_30px_-12px_rgb(29_25_18/0.25)] backdrop-blur transition-transform duration-300 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-sandline">
          <Image
            src={product.images[0]?.src ?? "/images/product-1.jpg"}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-ink">
            {product.shortName} Mini Printer
          </p>
          <p className="font-mono text-[15px] font-bold text-ink">
            {formatINR(product.priceInPaise)}
            {product.shippingInPaise === 0 ? (
              <span className="ml-1.5 font-sans text-[11px] font-semibold text-leaf">
                Free shipping
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={buyNow}
          tabIndex={visible ? 0 : -1}
          className="min-h-11 shrink-0 rounded-full bg-accent px-6 text-[15px] font-bold text-white shadow-[0_6px_18px_-6px_rgb(228_82_14/0.55)] transition active:scale-[0.98] hover:bg-accent-deep"
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
