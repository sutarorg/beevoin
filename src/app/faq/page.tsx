import type { Metadata } from "next";
import Link from "next/link";
import { Accordion } from "@/components/accordion";
import { Container, Eyebrow, Section, SectionTitle } from "@/components/ui";
import { buildFaqs } from "@/lib/content";
import { getStorefrontProduct } from "@/lib/product";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Answers about the Beevo Go mini thermal printer — setup, ink-free printing, Android and iOS compatibility, paper, charging, delivery and returns.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const [settings, product] = await Promise.all([
    getStoreSettings(),
    getStorefrontProduct(),
  ]);

  const faqs = buildFaqs({
    dispatchWindow: settings.dispatchWindow,
    deliveryEstimate: settings.deliveryEstimate,
    replacementWindowDays: settings.replacementWindowDays,
    productShortName: product?.shortName ?? "Beevo Go",
  });

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Section className="pt-10 md:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <Container className="max-w-3xl">
        <Eyebrow>Help centre</Eyebrow>
        <SectionTitle className="mt-3">Frequently asked questions</SectionTitle>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Straight answers about the printer, the tech, delivery and returns.
          Still stuck?{" "}
          <Link
            href="/contact"
            className="font-bold text-accent-deep underline-offset-4 hover:underline"
          >
            Contact us
          </Link>{" "}
          — {settings.supportHours}.
        </p>
        <div className="mt-8">
          <Accordion items={faqs} />
        </div>
      </Container>
    </Section>
  );
}
