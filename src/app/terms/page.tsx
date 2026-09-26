import type { Metadata } from "next";
import { L, LegalPage, P } from "@/components/legal-page";
import { site } from "@/lib/config";
import { getPrimaryProduct } from "@/lib/product";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description:
    "The terms that govern your use of the Beevo website and purchases of the Beevo Go mini thermal printer.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const [settings, product] = await Promise.all([
    getStoreSettings(),
    getPrimaryProduct(),
  ]);

  return (
    <LegalPage
      title="Terms & Conditions"
      updated="February 2026"
      intro={`These terms govern your use of the ${site.name} website and your purchase of products from ${settings.legalName}. By placing an order, you agree to them. Please read them — they're short, in plain language, and free of surprises.`}
      sections={[
        {
          heading: "The store and the product",
          body: (
            <P>
              Beevo is a single-product store selling the {product?.name ?? "Beevo Go Mini Thermal Printer"}
              through this website. Product images are representative of the
              product and its use; minor cosmetic differences between batches
              (for example, colour shade or packaging artwork) do not
              constitute a defect.
            </P>
          ),
        },
        {
          heading: "Pricing",
          body: (
            <>
              <P>
                The product is priced at ₹1,499 per unit, inclusive of GST and
                all applicable taxes. Shipping is free across serviceable
                Indian pincodes — the total you see at checkout is the total
                you pay.
              </P>
              <P>
                We don&apos;t inflate MRPs to show fake discounts, and we
                don&apos;t add hidden charges at checkout.
              </P>
            </>
          ),
        },
        {
          heading: "Your order",
          body: (
            <L
              items={[
                "An order is an offer to purchase. It is accepted when we confirm it, and for online payments, after payment is verified by our payment partner on our servers.",
                "You must provide accurate delivery and contact details; we are not responsible for failed deliveries caused by incorrect information.",
                `A maximum of ${product?.maxPerOrder ?? 5} units may be purchased per order. We may refuse or cancel orders that appear fraudulent, abusive or intended for unauthorised resale.`,
                "Each order gets a unique order ID. Keep it safe — you'll need it (with your registered mobile/email) to track or get support.",
              ]}
            />
          ),
        },
        {
          heading: "Payments",
          body: (
            <P>
              We accept Cash on Delivery (cash or UPI at your doorstep)
              {", and online payments (UPI, cards, netbanking and wallets) processed by Razorpay when enabled on the store"}
              . Payment verification for online payments happens on our
              servers; an order is confirmed only after successful
              verification. Failed or unverified payments are not collected,
              and any amount deducted by your bank in such cases is
              automatically reversed by the payment network per its own
              timelines.
            </P>
          ),
        },
        {
          heading: "Shipping, returns and refunds",
          body: (
            <P>
              Delivery timelines, our 7-day replacement promise and refund
              processes are described in our Shipping Policy and Returns &
              Refunds Policy, which form part of these terms.
            </P>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <P>
              You agree not to misuse the website — including attempting to
              disrupt the service, probe security controls, place fraudulent
              orders, or scrape content at abusive volumes. We may block
              access involved in such activity.
            </P>
          ),
        },
        {
          heading: "Intellectual property",
          body: (
            <P>
              The Beevo name, logo, website design, text and imagery on this
              site belong to {settings.legalName} or its licensors. You may not
              reuse them for commercial purposes without written permission.
            </P>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <P>
              To the extent permitted by law, our total liability for any
              claim relating to a purchase is limited to the amount you paid
              for that order. We are not liable for indirect or consequential
              losses. Nothing in these terms limits your statutory rights
              under the Consumer Protection Act, 2019.
            </P>
          ),
        },
        {
          heading: "Governing law",
          body: (
            <P>
              These terms are governed by the laws of India. Courts in India
              shall have jurisdiction over disputes, subject to the consumer
              protections available to you under law.
            </P>
          ),
        },
        {
          heading: "Contact",
          body: (
            <P>
              Questions about these terms? Write to {settings.supportEmail}
              {settings.businessAddress ? ` or reach us at ${settings.businessAddress}` : ""}.
            </P>
          ),
        },
      ]}
    />
  );
}
