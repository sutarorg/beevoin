"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleHelp, Menu, PackageSearch, ShoppingBag, X, Zap } from "lucide-react";
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

const ANNOUNCEMENTS = [
  "Free shipping across India",
  "Dispatches in 24–48h",
  "COD available",
];

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#specs", label: "Specs" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const { qty, hydrated } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu whenever the route changes. The router is an
  // external system; there is no render-time way to observe a navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a navigation
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-sandline/70 bg-paper/85 shadow-[0_1px_0_rgb(255_255_255/0.7)] backdrop-blur-xl">
      <div className="bg-ink text-[12px] font-bold tracking-wide text-paper">
        {/* Mobile: the strip is wider than the screen, so it auto-scrolls in
            a seamless endless loop (duplicated track, -50% translate). */}
        <div className="marquee py-2 md:hidden">
          <div
            className="marquee-track"
            style={{ animationDuration: "16s" }}
          >
            {[0, 1].map((dup) => (
              <p
                key={dup}
                aria-hidden={dup === 1}
                className="flex shrink-0 items-center whitespace-nowrap"
              >
                {ANNOUNCEMENTS.map((item) => (
                  <span key={item} className="flex items-center">
                    <span className="px-3">{item}</span>
                    <span className="text-accent" aria-hidden>
                      •
                    </span>
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>
        {/* Desktop: everything fits, so it stays static and centred. */}
        <p className="hidden px-4 py-2 text-center md:block">
          {ANNOUNCEMENTS.map((item, i) => (
            <span key={item}>
              {i > 0 ? (
                <span className="mx-2 text-accent" aria-hidden>
                  •
                </span>
              ) : null}
              {item}
            </span>
          ))}
        </p>
      </div>
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-3 px-5 sm:px-6 md:px-8">
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

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active =
              !link.href.startsWith("/#") &&
              (pathname === link.href || pathname.startsWith(`${link.href}/`));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm font-bold transition-colors",
                  active
                    ? "bg-white text-ink shadow-lift"
                    : "text-ink-soft hover:bg-white/70 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/#hero-cta"
            className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-deep px-4 py-2.5 text-sm font-extrabold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-pop md:inline-flex"
          >
            <Zap className="size-4" aria-hidden />
            Buy now
          </Link>
          <Link
            href="/track"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-cream hover:text-ink sm:inline-flex"
            aria-label="Track your order"
          >
            <PackageSearch className="size-4.5" aria-hidden />
            <span className="hidden md:inline">Track order</span>
          </Link>
          <Link
            href="/faq"
            className="inline-flex rounded-full p-2.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink sm:hidden"
            aria-label="Help and FAQ"
          >
            <CircleHelp className="size-5" aria-hidden />
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-2 rounded-full border border-sandline/70 bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-lift transition-all hover:-translate-y-0.5 hover:bg-cream"
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
          "border-t border-sandline/70 bg-paper/95 shadow-pop backdrop-blur-xl lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="space-y-2 px-5 py-4" aria-label="Mobile">
          <Link
            href="/#hero-cta"
            onClick={() => setOpen(false)}
            className="mb-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-deep px-4 py-3.5 text-[15px] font-extrabold text-white shadow-glow"
          >
            <Zap className="size-4.5" aria-hidden />
            Buy Beevo Go now
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-2xl px-4 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-white"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/track"
            onClick={() => setOpen(false)}
            className="block rounded-2xl px-4 py-3 text-[15px] font-bold text-accent-deep transition-colors hover:bg-accent-soft"
          >
            Track your order
          </Link>
        </nav>
      </div>
    </header>
  );
}
