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
import type { ProductView } from "@/lib/product-view";
import { formatINR } from "@/lib/format";

const STORAGE_KEY = "beevo-cart-v1";

type CartState = {
  /** The live catalogue row, fetched on the server. Null = nothing on sale. */
  product: ProductView | null;
  /** Quantity of the single product (0 = empty). */
  qty: number;
  subtotalInPaise: number;
  maxPerOrder: number;
  hydrated: boolean;
  add: (qty?: number) => void;
  setQty: (qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({
  product,
  children,
}: {
  product: ProductView | null;
  children: ReactNode;
}) {
  const maxPerOrder = product?.maxOrderableQuantity ?? 0;
  const clampQty = useCallback(
    (qty: number) => Math.min(Math.max(Math.round(qty) || 0, 0), maxPerOrder),
    [maxPerOrder],
  );

  const [qty, setQtyState] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { qty?: number };
        // localStorage can only be read after mount, so this hydration step
        // has to happen in an effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Stock can drop while a cart sits in localStorage, so the live product
  // row always wins over whatever was stored in the browser.
  const effectiveQty = Math.min(qty, maxPerOrder);

  const value = useMemo<CartState>(
    () => ({
      product,
      qty: effectiveQty,
      subtotalInPaise: effectiveQty * (product?.priceInPaise ?? 0),
      maxPerOrder,
      hydrated,
      add,
      setQty,
      clear,
    }),
    [product, effectiveQty, maxPerOrder, hydrated, add, setQty, clear],
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

/** Convenience accessor for components that only need the catalogue row. */
export function useProduct(): ProductView | null {
  return useCart().product;
}

export function cartLineSummary(product: ProductView, qty: number): string {
  return `${product.shortName} × ${qty} — ${formatINR(qty * product.priceInPaise)}`;
}
