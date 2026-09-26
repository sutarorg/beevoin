"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useCart } from "./cart-store";

/**
 * Sticky purchase bar — appears once the hero buy-box has been scrolled PAST
 * (not merely out of view — at the top of a mobile page the CTA sits below
 * the fold, and the bar must stay hidden there), on mobile (full-width bottom
 * bar) and desktop (floating pill), so a buy action is always one tap away.
 * It hides itself whenever another purchase moment is already on screen (the
 * pricing/receipt block or the footer) so it never competes with a primary
 * action.
 */
export function StickyBuyBar() {
  const router = useRouter();
  const { setQty, product } = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const heroCta = document.getElementById("hero-cta");
    if (!heroCta) return;
    // Other elements that already contain a buy action — when any is on
    // screen the sticky bar stands down.
    const others = ["pricing", "site-footer"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    let heroScrolledPast = false;
    const otherOnScreen = new Set<string>();
    const update = () =>
      setVisible(heroScrolledPast && others.every((el) => !otherOnScreen.has(el.id)));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target.id === "hero-cta") {
            // "Scrolled past" = not visible AND its top edge is above the
            // viewport. Below-the-fold at page top does NOT count.
            heroScrolledPast =
              !entry.isIntersecting && entry.boundingClientRect.top < 0;
          } else if (entry.isIntersecting) {
            otherOnScreen.add(entry.target.id);
          } else {
            otherOnScreen.delete(entry.target.id);
          }
        }
        update();
      },
      { threshold: 0 },
    );
    observer.observe(heroCta);
    others.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const buyNow = () => {
    setQty(1);
    router.push("/checkout");
  };

  if (!product.purchasable) return null;

  const codSaving = product.codPriceInPaise - product.priceInPaise;
  const lowStock = product.stockState === "low_stock";

  return (
    <div
      aria-hidden={!visible}
      className={`fixed bottom-0 inset-x-0 z-40 border-t border-sandline bg-white/95 shadow-[0_-8px_30px_-12px_rgb(29_25_18/0.25)] backdrop-blur transition-transform duration-300 md:inset-x-auto md:bottom-5 md:left-1/2 md:rounded-full md:border md:shadow-pop ${
        visible
          ? "translate-y-0 md:-translate-x-1/2"
          : "translate-y-full md:-translate-x-1/2 md:translate-y-[150%]"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 md:px-4">
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
          <p className="flex flex-wrap items-center gap-x-2 font-mono text-[15px] font-bold text-ink">
            {formatINR(product.priceInPaise)}<span className="hidden md:inline"> online</span>
            {codSaving > 0 ? (
              <span className="hidden rounded-full bg-leaf-soft px-2 py-0.5 font-sans text-[11px] font-bold text-leaf md:inline-flex">
                Save {formatINR(codSaving)} vs COD
              </span>
            ) : null}
            {lowStock ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-chili-soft px-2 py-0.5 font-sans text-[11px] font-bold text-chili">
                <Flame className="size-3" aria-hidden />
                Only {product.availableQuantity} left
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
