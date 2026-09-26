import type { Metadata } from "next";
import { CartClient } from "@/components/cart-client";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your Beevo Go order before checkout.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartClient />;
}
