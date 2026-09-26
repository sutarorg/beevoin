import type { Metadata } from "next";
import { CartClient } from "@/components/cart-client";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your Beevo Go order before checkout.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const settings = await getStoreSettings();
  return (
    <CartClient
      deliveryEstimate={settings.deliveryEstimate}
      replacementWindowDays={settings.replacementWindowDays}
    />
  );
}
