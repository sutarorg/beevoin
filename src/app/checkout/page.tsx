import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { payments } from "@/lib/config";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure checkout for your Beevo Go order.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <CheckoutForm
      razorpayEnabled={payments.razorpayEnabled}
      razorpayKeyId={payments.razorpayKeyId}
      storeName={settings.storeName}
      dispatchWindow={settings.dispatchWindow}
    />
  );
}
