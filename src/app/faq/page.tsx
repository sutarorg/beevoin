import type { Metadata } from "next";
import Link from "next/link";
import { Accordion } from "@/components/accordion";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, Container, Eyebrow, Section, SectionTitle } from "@/components/ui";
import { FAQS } from "@/lib/content";
import { site } from "@/lib/config";
import { guidesByFreshness } from "@/lib/guides";
import {
  breadcrumbLd,
  faqPageLd,
  graph,
  jsonLd,
  webPageLd,
  type Crumb,
} from "@/lib/seo";

const PATH = "/faq";
const DESCRIPTION =
  "Answers about the Beevo Go mini thermal printer — setup, ink-free printing, Android and iOS compatibility, 57 mm paper, charging, delivery and warranty.";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: PATH,
    title: "Beevo Go FAQ — mini thermal printer questions answered",
    description: DESCRIPTION,
  },
};

const crumbs: Crumb[] = [
  { name: "Home", path: "/" },
  { name: "FAQ", path: PATH },
];

/**
 * This is the one URL on the site that carries FAQPage markup for the store's
 * general questions. The home page intentionally renders the same six
 * questions for users without repeating the markup — duplicated FAQPage
 * across URLs is a reliable way to lose the rich result entirely.
 */
const ld = graph(
  webPageLd({
    path: PATH,
    name: "Beevo Go — frequently asked questions",
    description: DESCRIPTION,
    crumbs,
  }),
  breadcrumbLd(crumbs, PATH),
  faqPageLd(FAQS, PATH),
);

export default function FaqPage() {
  const guides = guidesByFreshness().slice(0, 4);

  return (
    <Section className="pt-8 md:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ld) }}
      />
      <Container className="max-w-3xl">
        <Breadcrumbs crumbs={crumbs} />
        <Eyebrow>Help centre</Eyebrow>
        <SectionTitle as="h1" className="mt-3">
          Frequently asked questions
        </SectionTitle>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Straight answers about the printer, the tech and delivery. Still
          stuck?{" "}
          <Link
            href="/contact"
            className="font-bold text-accent-deep underline-offset-4 hover:underline"
          >
            Contact us
          </Link>{" "}
          — {site.supportHours}.
        </p>
        <div className="mt-8">
          <Accordion items={FAQS} />
        </div>

        <Card className="mt-10 p-6">
          <h2 className="text-[17px] font-extrabold text-ink">
            Longer answers, in the guides
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
            Some questions deserve more than a paragraph. These go deeper.
          </p>
          <ul className="mt-4 space-y-2.5">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="text-[14.5px] font-bold text-accent-deep underline-offset-4 hover:underline"
                >
                  {guide.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </Container>
    </Section>
  );
}
