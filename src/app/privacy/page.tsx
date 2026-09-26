import type { Metadata } from "next";
import { L, LegalPage, P } from "@/components/legal-page";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Beevo collects, uses, stores and protects your personal information when you shop with us.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="February 2026"
      intro={`This policy explains what personal information ${site.legalName} ("Beevo", "we", "us") collects when you use our website, why we collect it, and the choices you have. It is written to comply with applicable Indian law, including the Digital Personal Data Protection Act, 2023.`}
      sections={[
        {
          heading: "What we collect",
          body: (
            <>
              <P>When you place an order or contact us, we collect only what the order needs:</P>
              <L
                items={[
                  "Identity and contact details — your name, mobile number and email address.",
                  "Delivery details — your full shipping address (street, locality, city, state, PIN code).",
                  "Order details — the product, quantity, amount paid, payment method and order status history.",
                  "Payment references — for online payments, the transaction IDs issued by our payment partner (Razorpay). We never see, collect or store your card number, UPI PIN, CVV or banking passwords.",
                  "Support messages — anything you send us through the contact form or email.",
                ]}
              />
              <P>
                We do not require you to create an account, and we do not run
                advertising trackers on this store.
              </P>
            </>
          ),
        },
        {
          heading: "Why we collect it",
          body: (
            <L
              items={[
                "To process, confirm and deliver your order.",
                "To send transactional updates about your order (confirmation, shipping, delivery, refund) by email.",
                "To verify your identity when you look up an order.",
                "To respond to your support requests.",
                "To meet our legal, tax and accounting obligations.",
                "To prevent fraud, misuse and abuse of the store (including rate-limiting by IP address).",
              ]}
            />
          ),
        },
        {
          heading: "Who we share it with",
          body: (
            <>
              <P>We share only what is necessary, only with the partners who help us serve you:</P>
              <L
                items={[
                  "Courier and logistics partners — your name, address and phone number, so they can deliver.",
                  "Payment processors (Razorpay) — when you choose to pay online, the payment details you enter go directly to them under their own privacy policy.",
                  "Email delivery providers — your email address, so order updates can reach you.",
                ]}
              />
              <P>
                We do not sell your personal information to anyone, and we do
                not send promotional emails without your consent.
              </P>
            </>
          ),
        },
        {
          heading: "How we protect your information",
          body: (
            <P>
              Our website is served over HTTPS, access to order data is
              restricted to authorised personnel, and administrative access is
              password protected. Order lookups require both your order ID and
              a verification factor (your registered mobile number, email or
              the private link we send you). No method of transmission or
              storage is perfectly secure, but we work to protect your data and
              will inform you and the relevant authorities if a breach affects
              you, as required by law.
            </P>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <P>
              Order records are retained for as long as needed to fulfil your
              order and to meet tax, accounting and legal requirements. Support
              messages are kept until resolved, plus a short reference period.
              When data is no longer required, it is deleted or anonymised.
            </P>
          ),
        },
        {
          heading: "Cookies",
          body: (
            <P>
              We use a small number of functional cookies — for example, to
              keep the store admin signed in. Your shopping cart is stored on
              your own device (browser local storage) and is never sent to us
              until you check out. We do not use advertising or cross-site
              tracking cookies.
            </P>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <>
              <P>You can contact us at any time to:</P>
              <L
                items={[
                  "Access a copy of the personal information we hold about your orders.",
                  "Correct inaccurate details (for example, a delivery address — before your order ships).",
                  "Request deletion of your personal information where the law allows it.",
                  "Withdraw consent for any optional communication.",
                ]}
              />
              <P>
                Write to us at {site.supportEmail} from your registered email
                and we&apos;ll act on verified requests as required by law.
              </P>
            </>
          ),
        },
        {
          heading: "Grievance officer & contact",
          body: (
            <P>
              For any privacy concern or complaint, contact our grievance
              officer at {site.supportEmail}
              {site.address ? `, or write to ${site.address}` : ""}. Include
              your order ID where relevant. We aim to acknowledge complaints
              within 48 hours and resolve them promptly.
            </P>
          ),
        },
        {
          heading: "Changes to this policy",
          body: (
            <P>
              If we change this policy, we&apos;ll update the date at the top
              of this page. Continued use of the store after changes means you
              accept the updated policy.
            </P>
          ),
        },
      ]}
    />
  );
}
