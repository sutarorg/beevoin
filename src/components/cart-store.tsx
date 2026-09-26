"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2 } from "lucide-react";
import type { StorefrontProduct } from "@/lib/product-types";
import { formatINR } from "@/lib/format";

const STORAGE_KEY = "beevo-cart-v1";

type CartState = {
  /** Quantity of the single product (0 = empty). */
  qty: number;
  subtotalInPaise: number;
  maxPerOrder: number;
  hydrated: boolean;
  /** The authoritative product, read from the database on the server. */
  product: StorefrontProduct;
  add: (qty?: number) => void;
  setQty: (qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

/**
 * Cart + product context.
 *
 * The product (price, max per order, stock) is injected by the server layout
 * from the `products` table — the storefront never hard-codes commercial
 * values, and the checkout API re-validates everything anyway.
 */
export function CartProvider({
  children,
  product,
}: {
  children: ReactNode;
  product: StorefrontProduct;
}) {
  const cap = Math.max(1, Math.min(product.maxPerOrder, product.availableQuantity || product.maxPerOrder));
  const clampQty = useCallback(
    (value: number) => Math.min(Math.max(Math.round(value) || 0, 0), cap),
    [cap],
  );

  const [qty, setQtyState] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydration pass: localStorage is a browser-only external store, so it can
  // only be read after mount. This is the documented escape hatch for syncing
  // React state from an external system that does not exist during SSR.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { qty?: number };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the persisted cart on mount
        setQtyState(clampQty(Number(parsed.qty ?? 0)));
      }
    } catch {
      // Corrupt storage — start fresh.
    }
    setHydrated(true);
  }, [clampQty]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ qty }));
    } catch {
      // Private mode etc. — cart simply won't persist.
    }
  }, [qty, hydrated]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const add = useCallback(
    (amount = 1) => {
      setQtyState((current) => clampQty(current + amount));
      showToast("Added to your cart");
    },
    [showToast, clampQty],
  );

  const setQty = useCallback(
    (next: number) => {
      setQtyState(clampQty(next));
    },
    [clampQty],
  );

  const clear = useCallback(() => setQtyState(0), []);

  const value = useMemo<CartState>(
    () => ({
      qty,
      subtotalInPaise: qty * product.priceInPaise,
      maxPerOrder: cap,
      hydrated,
      product,
      add,
      setQty,
      clear,
    }),
    [qty, hydrated, product, cap, add, setQty, clear],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Lightweight toast — polite live region, sits above the sticky bar */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4"
      >
        {toast ? (
          <div className="toast-in flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white shadow-pop">
            <CheckCircle2 className="size-4 text-leaf-soft" aria-hidden />
            {toast}
          </div>
        ) : null}
      </div>
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/** Convenience accessor for components that only need the product. */
export function useProduct(): StorefrontProduct {
  return useCart().product;
}

