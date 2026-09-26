"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  HandCoins,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Undo2,
} from "lucide-react";
import { policies } from "@/lib/config";
import { formatINR } from "@/lib/format";
import { useCart } from "./cart-store";
import { Badge, Card, Container, Section, buttonClasses } from "./ui";

function CartSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading cart">
      <div className="h-36 rounded-2xl bg-cream" />
      <div className="h-44 rounded-2xl bg-cream" />
    </div>
  );
}

export function CartClient() {
  const { qty, setQty, clear, subtotalInPaise, hydrated, maxPerOrder, product } =
    useCart();
  const shippingInPaise = qty > 0 ? product.shippingInPaise : 0;
  const totalInPaise = subtotalInPaise + shippingInPaise;

  return (
    <Section className="pt-10 md:pt-14">
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Your cart
        </h1>

        {!hydrated ? (
          <div className="mt-8">
            <CartSkeleton />
          </div>
        ) : qty === 0 ? (
          <Card className="mt-8 flex flex-col items-center gap-5 p-10 text-center">
            <span className="rounded-full bg-cream p-5">
              <ShoppingBag className="size-8 text-ink-faint" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-extrabold text-ink">
                Your cart is empty
              </p>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                Good news: there&apos;s only one thing to choose, and it&apos;s
                a good one.
              </p>
            </div>
            <Link href="/" className={buttonClasses({ size: "lg" })}>
              Meet the {product.shortName}
              <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          </Card>
        ) : (
          <div className="mt-8 space-y-4">
            {/* Line item */}
            <Card className="p-5">
              <div className="flex gap-4">
                <Link
                  href="/"
                  className="relative size-22 shrink-0 overflow-hidden rounded-xl border border-sandline sm:size-26"
                >
                  <Image
                    src={product.images[0]?.src ?? "/images/product-1.jpg"}
                    alt={product.name}
                    fill
                    sizes="104px"
                    className="object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href="/"
                        className="text-[15.5px] font-extrabold text-ink hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-[13px] font-semibold text-ink-faint">
                        Ink-free pocket printer · SKU {product.sku}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clear}
                      className="rounded-full p-2 text-ink-faint transition-colors hover:bg-chili-soft hover:text-chili"
                      aria-label={`Remove ${product.name} from cart`}
                    >
                      <Trash2 className="size-4.5" aria-hidden />
                    </button>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div
                      className="inline-flex items-center rounded-full border-[1.5px] border-sandline"
                      role="group"
                      aria-label="Quantity"
                    >
                      <button
                        type="button"
                        onClick={() => setQty(qty - 1)}
                        disabled={qty <= 1}
                        className="p-2.5 text-ink transition disabled:opacity-30"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <span
                        className="w-8 text-center font-mono text-[15px] font-bold tabular-nums"
                        aria-live="polite"
                      >
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(qty + 1)}
                        disabled={qty >= maxPerOrder}
                        className="p-2.5 text-ink transition disabled:opacity-30"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    <p className="font-mono text-lg font-bold tabular-nums text-ink">
                      {formatINR(subtotalInPaise)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary */}
            <Card className="p-6">
              <h2 className="text-[15px] font-extrabold uppercase tracking-wider text-ink-faint">
                Order summary
              </h2>
              <dl className="mt-4 space-y-2.5 text-[15px]">
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink-soft">Subtotal</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {formatINR(subtotalInPaise)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink-soft">Shipping</dt>
                  <dd
                    className={
                      shippingInPaise === 0
                        ? "font-bold text-leaf"
                        : "font-mono font-bold tabular-nums"
                    }
                  >
                    {shippingInPaise === 0 ? "FREE" : formatINR(shippingInPaise)}
                  </dd>
                </div>
                <div className="dashed-rule my-2" />
                <div className="flex items-baseline justify-between">
                  <dt className="font-bold text-ink">Total</dt>
                  <dd className="font-mono text-xl font-bold tabular-nums text-ink">
                    {formatINR(totalInPaise)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[12.5px] font-semibold text-ink-faint">
                Inclusive of all taxes. No hidden charges at checkout.
              </p>
              <Link
                href="/checkout"
                className={buttonClasses({ size: "lg", className: "mt-5 w-full" })}
              >
                Proceed to checkout
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12.5px] font-bold text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="size-4 text-leaf" aria-hidden />
                  {policies.deliveryEstimate}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HandCoins className="size-4 text-leaf" aria-hidden />
                  COD available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Undo2 className="size-4 text-leaf" aria-hidden />
                  7-day replacement
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-leaf" aria-hidden />
                  Secure checkout
                </span>
              </div>
            </Card>

            <p className="text-center">
              <Link
                href="/"
                className="text-sm font-bold text-accent-deep underline-offset-4 hover:underline"
              >
                ← Continue browsing
              </Link>
            </p>
          </div>
        )}
      </Container>
    </Section>
  );
}
