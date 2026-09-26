import type { Metadata } from "next";
import { Mail, PackageSearch, Timer } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, Container, Section } from "@/components/ui";
import {
  ORG_ID,
  abs,
  breadcrumbLd,
  graph,
  jsonLd,
  webPageLd,
  type Crumb,
} from "@/lib/seo";
import { policies, site } from "@/lib/config";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Get help with your Beevo order — delivery, replacement support, product questions or anything else. We reply within one business day.",
  alternates: { canonical: "/contact" },
};

const crumbs: Crumb[] = [
  { name: "Home", path: "/" },
  { name: "Contact", path: "/contact" },
];

const DESCRIPTION =
  "Get help with your Beevo order — delivery, replacement support, product questions or anything else. A real person replies within one business day.";

const ld = graph(
  webPageLd({
    path: "/contact",
    name: "Contact Beevo",
    description: DESCRIPTION,
    crumbs,
  }),
  breadcrumbLd(crumbs, "/contact"),
  {
    "@type": "ContactPage",
    "@id": `${abs("/contact")}#contactpage`,
    url: abs("/contact"),
    about: { "@id": ORG_ID },
    isPartOf: { "@id": `${abs("/contact")}#webpage` },
  },
);

export default function ContactPage() {
  return (
    <Section className="pt-8 md:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ld) }}
      />
      <Container className="max-w-5xl">
        <Breadcrumbs crumbs={crumbs} />
        <div className="max-w-xl space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Talk to a human
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Order questions, delivery hiccups, replacement support, product help —
            write to us and a real person will get back to you.
          </p>
        </div>

        <div className="mt-9 grid items-start gap-7 lg:grid-cols-[1fr_22rem]">
          <ContactForm />

          <aside className="space-y-4">
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                <Mail className="size-4.5 text-accent-deep" aria-hidden />
                Email us directly
              </h2>
              <a
                href={`mailto:${site.supportEmail}`}
                className="mt-2 block font-mono text-[15px] font-bold text-accent-deep hover:underline"
              >
                {site.supportEmail}
              </a>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-faint">
                <Timer className="size-3.5" aria-hidden />
                {site.supportHours} · replies within one business day
              </p>
            </Card>
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                <PackageSearch className="size-4.5 text-accent-deep" aria-hidden />
                Fastest help
              </h2>
              <ul className="mt-3 space-y-2.5 text-[13.5px] font-semibold leading-relaxed text-ink-soft">
                <li>
                  Checking delivery?{" "}
                  <Link href="/track" className="font-bold text-accent-deep hover:underline">
                    Track your order
                  </Link>{" "}
                  — it updates live.
                </li>
                <li>
                  Damaged or defective unit? Request a replacement within{" "}
                  {policies.replacementWindowDays} days of delivery — keep your
                  order ID and a short video of the issue handy.
                </li>
                <li>
                  Product how-tos? The{" "}
                  <Link href="/faq" className="font-bold text-accent-deep hover:underline">
                    FAQ
                  </Link>{" "}
                  covers setup, charging and paper.
                </li>
              </ul>
            </Card>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
