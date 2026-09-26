"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, PackageSearch, ShoppingBag, X, Zap } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useCart } from "./cart-store";
import { cn } from "@/lib/cn";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
      role="presentation"
    >
      <rect x="3" y="10" width="26" height="17" rx="5" fill="#1D1912" />
      <rect x="8" y="3" width="16" height="12" rx="2.5" fill="#fff" stroke="#1D1912" strokeWidth="2" />
      <path d="M11.5 7.5h9M11.5 11h5.5" stroke="#E4520E" strokeWidth="2" strokeLinecap="round" />
      <circle cx="23.5" cy="19" r="1.8" fill="#E4520E" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#specs", label: "Specs" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const { qty, hydrated, product, setQty } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Close the mobile menu whenever the route changes. The router is an
  // external system; there is no render-time way to observe a navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a navigation
    setOpen(false);
  }, [pathname]);

  const quickBuy = () => {
    setQty(1);
    router.push("/checkout");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-sandline/70 bg-paper/90 backdrop-blur-md">
      <p className="bg-ink py-2 text-center text-[12px] font-bold tracking-wide text-paper">
        Free shipping across India
        <span className="mx-2 text-accent" aria-hidden>
          •
        </span>
        Cash on Delivery available
      </p>
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center justify-between gap-3 px-5 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Beevo — home"
        >
          <LogoMark className="size-8" />
          <span className="font-display text-[1.55rem] font-bold leading-none tracking-tight text-ink">
            beevo<span className="text-accent">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-bold text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* Persistent quick-buy: the purchase action is always one tap away,
              in the header of every storefront page — not buried mid-page. */}
          {product.purchasable ? (
            <button
              type="button"
              onClick={quickBuy}
              aria-label={`Buy ${product.shortName} now for ${formatINR(product.priceInPaise)}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-extrabold text-white shadow-[0_6px_18px_-6px_rgb(228_82_14/0.55)] transition active:scale-[0.97] hover:bg-accent-deep"
            >
              <Zap className="size-4" aria-hidden />
              <span className="hidden min-[420px]:inline">
                Buy · {formatINR(product.priceInPaise)}
              </span>
              <span className="min-[420px]:hidden">Buy</span>
            </button>
          ) : null}
          <Link
            href="/track"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-cream hover:text-ink sm:inline-flex"
            aria-label="Track your order"
          >
            <PackageSearch className="size-4.5" aria-hidden />
            <span className="hidden md:inline">Track order</span>
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-sandline"
            aria-label={
              hydrated && qty > 0
                ? `Cart, ${qty} item${qty > 1 ? "s" : ""}`
                : "Cart"
            }
          >
            <ShoppingBag className="size-4.5" aria-hidden />
            <span className="hidden sm:inline">Cart</span>
            {hydrated && qty > 0 ? (
              <span
                className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-white"
                aria-hidden
              >
                {qty}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex rounded-full p-2.5 text-ink transition-colors hover:bg-cream lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-nav"
        className={cn(
          "border-t border-sandline/70 bg-paper lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="space-y-1 px-5 py-4" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-cream"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/track"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-4 py-3 text-[15px] font-bold text-accent-deep transition-colors hover:bg-accent-soft"
          >
            Track your order
          </Link>
        </nav>
      </div>
    </header>
  );
}
