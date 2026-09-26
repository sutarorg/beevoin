import type { Metadata } from "next";
import { L, LegalPage, P } from "@/components/legal-page";
import { site } from "@/lib/config";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Shipping policy",
  description:
    "How Beevo ships your order — free shipping across India, dispatch times, delivery estimates and tracking.",
  alternates: { canonical: "/shipping" },
};

export default async function ShippingPage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage
      title="Shipping Policy"
      updated="February 2026"
      intro="Simple, honest shipping: free delivery across serviceable Indian pincodes, with tracking from dispatch to doorstep."
      sections={[
        {
          heading: "Shipping charges",
          body: (
            <P>
              Shipping is <strong>free</strong> for all orders, on all payment
              methods (including Cash on Delivery), to every serviceable
              pincode in India. The checkout total is exactly what you pay.
            </P>
          ),
        },
        {
          heading: "Where we deliver",
          body: (
            <P>
              We currently ship within India only. If your pincode is
              temporarily unserviceable by our courier partners, we&apos;ll
              contact you and either arrange an alternative or cancel with a
              full refund — your choice.
            </P>
          ),
        },
        {
          heading: "Dispatch time",
          body: (
            <P>
              Orders are packed and dispatched within{" "}
              <strong>{settings.dispatchWindow}</strong>. Orders placed on
              Sundays or public holidays are processed the next working day.
            </P>
          ),
        },
        {
          heading: "Delivery time",
          body: (
            <>
              <P>
                Typical delivery takes <strong>{settings.deliveryEstimate}</strong>{" "}
                after dispatch, depending on your pincode. Metro cities are
                usually faster; remote/north-eastern locations may take a
                little longer.
              </P>
              <P>
                These are estimates, not guarantees — courier delays,
                weather and regional disruptions can occasionally add a day or
                two. Your tracking page always shows the latest status.
              </P>
            </>
          ),
        },
        {
          heading: "Tracking your order",
          body: (
            <P>
              You&apos;ll receive email updates as your order is confirmed,
              packed, shipped, out for delivery and delivered. You can also
              check anytime on our Track Order page using your order ID
              together with your registered mobile number or email. Once the
              order ships, the courier name and tracking ID appear there too.
            </P>
          ),
        },
        {
          heading: "Delivery attempts",
          body: (
            <L
              items={[
                "Couriers typically attempt delivery up to 2–3 times and may call your registered mobile before arriving.",
                "For COD orders, please keep the order amount ready in cash, or pay by UPI at the door.",
                "If a delivery fails repeatedly, the package may be returned to us, and for prepaid orders we will refund you after deducting any re-shipping costs.",
              ]}
            />
          ),
        },
        {
          heading: "Damaged in transit?",
          body: (
            <P>
              If the outer package or the product looks damaged on arrival,
              refuse delivery if possible, or note the damage and contact us
              within 48 hours with photos — we&apos;ll arrange a replacement
              under our Returns & Refunds Policy. Reach us at{" "}
              {settings.supportEmail}.
            </P>
          ),
        },
        {
          heading: "Address changes",
          body: (
            <P>
              Address changes are possible only before dispatch. Write to{" "}
              {settings.supportEmail} with your order ID as soon as possible. Once
              an order is with the courier, we can&apos;t modify the delivery
              address.
            </P>
          ),
        },
      ]}
    />
  );
}
