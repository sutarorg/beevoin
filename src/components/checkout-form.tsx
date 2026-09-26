"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  HandCoins,
  Loader2,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { INDIAN_STATES, checkoutSchema } from "@/lib/validations";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCart, useProduct } from "./cart-store";
import { ProductPhoto } from "./product-photo";
import {
  Card,
  Container,
  Field,
  Section,
  buttonClasses,
  inputClasses,
} from "./ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

type FieldErrors = Record<string, string | undefined>;
type FormValues = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
};

const EMPTY: FormValues = {
  name: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  locality: "",
  city: "",
  state: "",
  pincode: "",
};

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load payment gateway"));
    document.body.appendChild(script);
  });
}

export function CheckoutForm({
  razorpayEnabled,
  razorpayKeyId,
  storeName,
  dispatchWindow,
}: {
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  storeName: string;
  dispatchWindow: string;
}) {
  const router = useRouter();
  const { qty, setQty, subtotalInPaise, hydrated, maxPerOrder, clear } =
    useCart();
  const product = useProduct();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [submitting, setSubmitting] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Display only — the server recomputes every paisa from the product row.
  const totalInPaise = subtotalInPaise + (product?.shippingInPaise ?? 0);

  const set =
    (key: keyof FormValues) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ): void => {
      const v = e.target.value;
      setValues((prev) => ({ ...prev, [key]: v }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const buttonLabel = useMemo(() => {
    if (paymentMethod === "cod")
      return `Place order — ${formatINR(totalInPaise)} · Pay on delivery`;
    return `Pay ${formatINR(totalInPaise)} securely`;
  }, [paymentMethod, totalInPaise]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = checkoutSchema.safeParse({
      ...values,
      quantity: qty,
      paymentMethod,
    });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    setStatusNote(
      paymentMethod === "cod" ? "Placing your order…" : "Preparing secure payment…",
    );

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, quantity: qty, paymentMethod }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
        mode?: "cod" | "razorpay";
        redirect?: string;
        orderNumber?: string;
        razorpay?: { orderId: string; amount: number; currency: string };
      };

      if (!res.ok || !data.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.mode === "cod" && data.redirect) {
        clear();
        router.push(data.redirect);
        return;
      }

      // ---- Razorpay online payment ----
      if (data.mode === "razorpay" && data.razorpay && data.orderNumber) {
        const orderNumber = data.orderNumber;
        await loadRazorpayScript();
        if (!window.Razorpay) throw new Error("Gateway unavailable");

        setStatusNote("Waiting for payment…");
        const rzp = new window.Razorpay({
          key: razorpayKeyId,
          amount: data.razorpay.amount,
          currency: data.razorpay.currency,
          name: storeName,
          description: `${product?.name ?? "Beevo order"} — ${orderNumber}`,
          order_id: data.razorpay.orderId,
          prefill: {
            name: values.name,
            email: values.email,
            contact: values.phone,
          },
          theme: { color: "#E4520E" },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              setStatusNote(null);
              setFormError(
                "Payment was not completed. Your order is saved — you can try again whenever you're ready.",
              );
            },
          },
          handler: async (response: Record<string, unknown>) => {
            try {
              setStatusNote("Verifying payment…");
              const verifyRes = await fetch("/api/payments/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderNumber,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyData = (await verifyRes.json()) as {
                ok: boolean;
                redirect?: string;
                error?: string;
              };
              if (verifyData.ok && verifyData.redirect) {
                clear();
                router.push(verifyData.redirect);
              } else {
                setFormError(
                  verifyData.error ??
                    "We couldn't verify the payment. If money was deducted, it will be auto-refunded by your bank; contact support with your order ID.",
                );
              }
            } catch {
              setFormError(
                "Network error while verifying payment. If money was deducted, contact support with your order ID.",
              );
            } finally {
              setSubmitting(false);
              setStatusNote(null);
            }
          },
        });
        rzp.on("payment.failed", () => {
          setSubmitting(false);
          setStatusNote(null);
          setFormError(
            "The payment failed or was cancelled. No amount has been confirmed — you can try again safely.",
          );
        });
        rzp.open();
        return;
      }

      setFormError("Unexpected response from the server. Please try again.");
    } catch {
      setFormError(
        "Network error — please check your connection and try again. Your cart is safe.",
      );
    } finally {
      setSubmitting((s) => (paymentMethod === "cod" ? false : s));
      if (paymentMethod === "cod") setStatusNote(null);
    }
  }

  const input = (key: keyof FormValues) => ({
    id: `f-${key}`,
    value: values[key],
    onChange: set(key),
    className: inputClasses(Boolean(errors[key])),
    "aria-invalid": Boolean(errors[key]) || undefined,
  });

  return (
    <Section className="pt-8 md:pt-12">
      <Container className="max-w-5xl">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to cart
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Checkout
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
          <Lock className="size-3.5" aria-hidden />
          Your details are encrypted in transit and used only to fulfil this order.
        </p>

        {!hydrated ? (
          <div className="mt-8 animate-pulse space-y-4">
            <div className="h-28 rounded-2xl bg-cream" />
            <div className="h-80 rounded-2xl bg-cream" />
          </div>
        ) : qty === 0 ? (
          <Card className="mt-8 flex flex-col items-center gap-5 p-10 text-center">
            <span className="rounded-full bg-cream p-5">
              <ShoppingBag className="size-8 text-ink-faint" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-extrabold text-ink">
                Nothing to check out yet
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Add the {product?.shortName ?? "Beevo Go"} to your cart first.
              </p>
            </div>
            <Link href="/" className={buttonClasses({ size: "lg" })}>
              Back to the product
            </Link>
          </Card>
        ) : (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
            {/* ===== Form ===== */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="order-2 space-y-6 lg:order-1"
            >
              <Card className="p-6 md:p-7">
                <h2 className="font-display text-xl font-semibold text-ink">
                  Where should we deliver?
                </h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="f-name" error={errors.name}>
                    <input
                      {...input("name")}
                      type="text"
                      autoComplete="name"
                      placeholder="e.g. Ananya Iyer"
                    />
                  </Field>
                  <Field
                    label="Mobile number"
                    htmlFor="f-phone"
                    error={errors.phone}
                    hint="10-digit Indian mobile — for delivery updates"
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-bold text-ink-faint">
                        +91
                      </span>
                      <input
                        {...input("phone")}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="98765 43210"
                        className={cn(inputClasses(Boolean(errors.phone)), "pl-13")}
                      />
                    </div>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Email" htmlFor="f-email" error={errors.email} hint="Order confirmation & tracking link go here">
                      <input
                        {...input("email")}
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      label="Flat / House no. & Street"
                      htmlFor="f-addressLine1"
                      error={errors.addressLine1}
                    >
                      <input
                        {...input("addressLine1")}
                        type="text"
                        autoComplete="address-line1"
                        placeholder="e.g. B-204, Lakeview Residency, 5th Cross"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      label="Apartment / Building / Landmark"
                      htmlFor="f-addressLine2"
                      error={errors.addressLine2}
                      optional
                    >
                      <input
                        {...input("addressLine2")}
                        type="text"
                        autoComplete="address-line2"
                        placeholder="Near City Mall"
                      />
                    </Field>
                  </div>
                  <Field label="Area / Locality" htmlFor="f-locality" error={errors.locality}>
                    <input
                      {...input("locality")}
                      type="text"
                      autoComplete="address-level3"
                      placeholder="e.g. Indiranagar"
                    />
                  </Field>
                  <Field label="City" htmlFor="f-city" error={errors.city}>
                    <input
                      {...input("city")}
                      type="text"
                      autoComplete="address-level2"
                      placeholder="e.g. Bengaluru"
                    />
                  </Field>
                  <Field label="State" htmlFor="f-state" error={errors.state}>
                    <select {...input("state")} autoComplete="address-level1">
                      <option value="">Select your state</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="PIN code" htmlFor="f-pincode" error={errors.pincode}>
                    <input
                      {...input("pincode")}
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      placeholder="560038"
                    />
                  </Field>
                </div>
              </Card>

              {/* ===== Payment method ===== */}
              <Card className="p-6 md:p-7">
                <h2 className="font-display text-xl font-semibold text-ink">
                  How would you like to pay?
                </h2>
                <div className="mt-5 space-y-3" role="radiogroup" aria-label="Payment method">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] p-4.5 transition",
                      paymentMethod === "cod"
                        ? "border-accent bg-accent-soft/60"
                        : "border-sandline bg-white hover:border-ink-faint/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                      className="mt-1 size-4.5 accent-[#E4520E]"
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2 font-extrabold text-ink">
                        <HandCoins className="size-4.5 text-accent-deep" aria-hidden />
                        Cash on Delivery (COD)
                        <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-[11px] font-extrabold text-leaf">
                          No advance payment
                        </span>
                      </span>
                      <span className="mt-1 block text-[13.5px] font-medium text-ink-soft">
                        Pay by cash or UPI when your order arrives at your door.
                      </span>
                    </span>
                  </label>

                  {razorpayEnabled ? (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] p-4.5 transition",
                        paymentMethod === "online"
                          ? "border-accent bg-accent-soft/60"
                          : "border-sandline bg-white hover:border-ink-faint/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="online"
                        checked={paymentMethod === "online"}
                        onChange={() => setPaymentMethod("online")}
                        className="mt-1 size-4.5 accent-[#E4520E]"
                      />
                      <span className="flex-1">
                        <span className="flex items-center gap-2 font-extrabold text-ink">
                          <CreditCard className="size-4.5 text-accent-deep" aria-hidden />
                          Pay online — UPI, cards, netbanking
                        </span>
                        <span className="mt-1 block text-[13.5px] font-medium text-ink-soft">
                          Securely processed by Razorpay. Payment is verified
                          on our servers before your order is confirmed.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </Card>

              {formError ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-2xl border border-chili/30 bg-chili-soft p-4.5"
                >
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-chili" aria-hidden />
                  <p className="text-sm font-bold text-chili">{formError}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className={buttonClasses({ size: "lg", className: "w-full" })}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    {statusNote ?? "Processing…"}
                  </>
                ) : (
                  buttonLabel
                )}
              </button>
              <p className="text-center text-[12.5px] leading-relaxed text-ink-faint">
                By placing this order you agree to our{" "}
                <Link href="/terms" className="font-bold underline underline-offset-2">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-bold underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>

            {/* ===== Summary ===== */}
            <aside className="order-1 lg:order-2 lg:sticky lg:top-30">
              <Card className="p-6">
                <div className="flex gap-4">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-sandline">
                    <ProductPhoto
                      src={product?.images[0]?.src ?? "/images/product-1.jpg"}
                      alt={product?.name ?? ""}
                      sizes="80px"
                      compact
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-extrabold leading-snug text-ink">
                      {product?.name}
                    </p>
                    <div
                      className="mt-2 inline-flex items-center rounded-full border-[1.5px] border-sandline"
                      role="group"
                      aria-label="Quantity"
                    >
                      <button
                        type="button"
                        onClick={() => setQty(qty - 1)}
                        disabled={qty <= 1}
                        className="p-2 text-ink disabled:opacity-30"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </button>
                      <span className="w-7 text-center font-mono text-sm font-bold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(qty + 1)}
                        disabled={qty >= maxPerOrder}
                        className="p-2 text-ink disabled:opacity-30"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
                <dl className="mt-5 space-y-2.5 border-t border-dashed border-sandline pt-4 text-[15px]">
                  <div className="flex justify-between">
                    <dt className="font-semibold text-ink-soft">
                      {formatINR(product?.priceInPaise ?? 0)} × {qty}
                    </dt>
                    <dd className="font-mono font-bold tabular-nums">
                      {formatINR(subtotalInPaise)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-semibold text-ink-soft">Shipping</dt>
                    <dd className="font-bold text-leaf">
                      {product && product.shippingInPaise > 0
                        ? formatINR(product.shippingInPaise)
                        : "FREE"}
                    </dd>
                  </div>
                  <div className="dashed-rule my-1.5" />
                  <div className="flex items-baseline justify-between">
                    <dt className="font-bold text-ink">To pay</dt>
                    <dd className="font-mono text-xl font-bold tabular-nums">
                      {formatINR(totalInPaise)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[12.5px] font-semibold text-ink-faint">
                  Inclusive of all taxes · Dispatched within {dispatchWindow}
                </p>
              </Card>
            </aside>
          </div>
        )}
      </Container>
    </Section>
  );
}
