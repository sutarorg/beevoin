"use client";

import { useRouter } from "next/navigation";
import {
  HandCoins,
  ShieldCheck,
  Truck,
  Undo2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { useCart } from "./cart-store";
import { buttonClasses } from "./ui";

/**
 * In-flow purchase band — the repeated "…here is where you buy it" beat that
 * keeps the primary action close no matter how far down the page someone
 * reads. Used mid-page (paper tone) and as the closing band (ink tone).
 *
 * Copy comes from the server page so pricing/marketing text has one source;
 * the price itself always comes from the database product (never invented).
 */
export function BuyBanner({
  eyebrow,
  title,
  note,
  tone = "paper",
}: {
  eyebrow: string;
  title: string;
  note: string;
  tone?: "paper" | "ink";
}) {
  const router = useRouter();
  const { setQty, product } = useCart();
  const inkTone = tone === "ink";

  const buyNow = () => {
    setQty(1);
    router.push("/checkout");
  };

  const chips = [
    { icon: Truck, label: "Free shipping" },
    { icon: HandCoins, label: "COD available" },
    { icon: Undo2, label: "7-day replacement" },
    { icon: ShieldCheck, label: "Secure checkout" },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border",
        inkTone
          ? "border-ink bg-ink text-paper shadow-pop"
          : "border-sandline bg-white shadow-lift",
      )}
    >
      <div className="grid items-center gap-6 p-6 md:grid-cols-[1.15fr_auto] md:gap-10 md:p-9">
        <div className="min-w-0 space-y-2.5">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.2em]",
              inkTone ? "text-paper/55" : "text-ink-faint",
            )}
          >
            {eyebrow}
          </p>
          <h3 className="font-display text-[1.65rem] font-light leading-[1.15] tracking-tight md:text-[2.1rem]">
            {title}
          </h3>
          <p
            className={cn(
              "max-w-md text-[14.5px] leading-relaxed",
              inkTone ? "text-paper/70" : "text-ink-soft",
            )}
          >
            {note}
          </p>
        </div>

        <div className="min-w-0 space-y-3 md:w-72">
          {product.purchasable ? (
            <>
              <p className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="font-display text-[2.2rem] font-medium leading-none tracking-tight">
                  {formatINR(product.priceInPaise)}
                </span>
                <span
                  className={cn(
                    "text-[13px] font-semibold",
                    inkTone ? "text-paper/60" : "text-ink-faint",
                  )}
                >
                  online · taxes & shipping included
                </span>
              </p>
              <button
                type="button"
                onClick={buyNow}
                className={buttonClasses({
                  size: "lg",
                  className: "btn-glow w-full",
                })}
              >
                <Zap className="size-4.5" aria-hidden />
                Buy now — {formatINR(product.priceInPaise)}
              </button>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
                {chips.map((chip) => (
                  <li
                    key={chip.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
                      inkTone ? "text-paper/75" : "text-ink-soft",
                    )}
                  >
                    <chip.icon
                      className={cn(
                        "size-4",
                        inkTone ? "text-accent" : "text-leaf",
                      )}
                      aria-hidden
                    />
                    {chip.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="inline-flex rounded-full bg-chili-soft px-4 py-2 text-sm font-bold text-chili">
              Currently unavailable — check back soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
