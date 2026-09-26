import type { ReactNode } from "react";
import { Breadcrumbs } from "./breadcrumbs";
import { breadcrumbLd, graph, jsonLd, webPageLd } from "@/lib/seo";
import { Container, Eyebrow, Section, SectionTitle } from "./ui";

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

export function LegalPage({
  eyebrow = "Beevo policies",
  title,
  updated,
  intro,
  sections,
  path,
  description,
}: {
  eyebrow?: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  /** Canonical path — drives the breadcrumb trail and its JSON-LD. */
  path: string;
  description: string;
}) {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: title, path },
  ];
  const ld = graph(
    webPageLd({ path, name: title, description, crumbs }),
    breadcrumbLd(crumbs, path),
  );

  return (
    <Section className="pt-10 md:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ld) }}
      />
      <Container className="max-w-3xl">
        <Breadcrumbs crumbs={crumbs} />
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionTitle as="h1" className="mt-3">
          {title}
        </SectionTitle>
        <p className="mt-2 text-[13px] font-semibold text-ink-faint">
          Last updated: {updated}
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{intro}</p>

        <div className="mt-9 space-y-9">
          {sections.map((section, i) => (
            <section key={i} aria-labelledby={`legal-h-${i}`}>
              <h2
                id={`legal-h-${i}`}
                className="flex items-baseline gap-3 text-lg font-extrabold text-ink"
              >
                <span className="font-mono text-sm font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 pl-0 text-[14.5px] leading-relaxed text-ink-soft sm:pl-9">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </Section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function L({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
