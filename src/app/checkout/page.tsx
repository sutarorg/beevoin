import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { payments } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure checkout for your Beevo Go order.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <CheckoutForm
      razorpayEnabled={payments.razorpayEnabled}
      razorpayKeyId={payments.razorpayKeyId}
    />
  );
}
