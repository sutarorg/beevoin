import type { Metadata } from "next";
import { L, LegalPage, P } from "@/components/legal-page";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Returns & refund policy",
  description:
    "Beevo's 7-day replacement promise — what's covered, how to claim, and how refunds are processed.",
  alternates: { canonical: "/returns" },
};

export default async function ReturnsPage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage
      title="Returns & Refund Policy"
      updated="February 2026"
      intro={`We want you to trust buying online. If something is wrong with your Beevo Go, this policy explains — without fine print — what we will do about it within ${settings.replacementWindowDays} days of delivery.`}
      sections={[
        {
          heading: "The 7-day promise",
          body: (
            <P>
              You can request a <strong>replacement or refund</strong> within{" "}
              {settings.replacementWindowDays} days of delivery if the
              product:
            </P>
          ),
        },
        {
          heading: "What's covered",
          body: (
            <L
              items={[
                "Arrives physically damaged.",
                "Is dead on arrival or has a manufacturing defect (won't turn on, won't charge, won't print).",
                "Is materially different from what was described on this website.",
                "Has missing box contents (verified against the packing list on the product page).",
              ]}
            />
          ),
        },
        {
          heading: "What's not covered",
          body: (
            <L
              items={[
                "Damage caused by drops, liquid exposure, disassembly or use of incompatible chargers/paper.",
                "Normal signs of use, or expectations mismatch after the product has worked correctly (for example, monochrome-only output — which is stated clearly on the product page).",
                "Minor cosmetic batch differences that don't affect function.",
                "Requests raised after the 7-day window.",
              ]}
            />
          ),
        },
        {
          heading: "How to raise a request",
          body: (
            <L
              items={[
                `Email ${settings.supportEmail} or use the contact form within 7 days of delivery.`,
                "Include your order ID, registered mobile number and a short unedited video or clear photos showing the issue while the product is unboxed/powered on.",
                "Our team verifies the claim — usually within 1–2 business days — and confirms the next step by email.",
                "For approved claims, we arrange a reverse pickup or share a self-ship address. Keep all box contents and packaging.",
              ]}
            />
          ),
        },
        {
          heading: "Replacements",
          body: (
            <P>
              Approved defective/damaged units are replaced with a new unit at
              no cost, including shipping both ways. Replacements are
              dispatched within 48 hours of the returned unit passing
              verification.
            </P>
          ),
        },
        {
          heading: "Refunds",
          body: (
            <>
              <P>
                Where replacement isn&apos;t possible (or an order is
                cancelled before shipping), refunds are issued to the{" "}
                <strong>original payment method</strong>:
              </P>
              <L
                items={[
                  "Online payments (UPI/cards/netbanking): refund is processed within 48 hours of approval; banks usually credit it within 5–7 business days.",
                  "Cash on Delivery: refund via UPI/bank transfer to details you provide, within 5–7 business days after the returned unit is verified.",
                ]}
              />
              <P>
                Every refund confirmation is emailed to you, and your order
                page will show the refunded status.
              </P>
            </>
          ),
        },
        {
          heading: "Cancellations",
          body: (
            <P>
              You can cancel an order free of charge any time before it is
              dispatched — email us with your order ID. Prepaid cancellations
              are refunded in full to the original payment method. Once
              shipped, an order can no longer be cancelled, but the 7-day
              promise above still applies.
            </P>
          ),
        },
        {
          heading: 'No "changed my mind" returns',
          body: (
            <P>
              To keep prices honest for everyone, we don&apos;t accept returns
              for reasons other than the ones listed above. Everything about
              the product — its size, monochrome output and paper format — is
              described on the product page and FAQ before you buy.
            </P>
          ),
        },
      ]}
    />
  );
}
