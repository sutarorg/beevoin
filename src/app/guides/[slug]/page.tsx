import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock, Lightbulb } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Card,
  Container,
  Eyebrow,
  Section,
  buttonClasses,
} from "@/components/ui";
import { site } from "@/lib/config";
import {
  GUIDES,
  formatGuideDate,
  getGuide,
  type Guide,
  type GuideBlock,
} from "@/lib/guides";
import {
  ORG_ID,
  abs,
  breadcrumbLd,
  faqPageLd,
  graph,
  jsonLd,
  webPageLd,
  type Crumb,
} from "@/lib/seo";

/** Fully static, pre-rendered at build time: instant TTFB, trivially crawlable. */
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export const dynamicParams = false;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  const path = `/guides/${guide.slug}`;
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title: guide.title,
      description: guide.metaDescription,
      publishedTime: guide.published,
      modifiedTime: guide.updated,
      authors: [site.name],
      images: [{ url: guide.image.src, alt: guide.image.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.metaTitle,
      description: guide.metaDescription,
      images: [guide.image.src],
    },
  };
}

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const path = `/guides/${guide.slug}`;
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: guide.title, path },
  ];

  const ld = graph(
    webPageLd({
      path,
      name: guide.title,
      description: guide.metaDescription,
      crumbs,
    }),
    breadcrumbLd(crumbs, path),
    {
      "@type": "Article",
      "@id": `${abs(path)}#article`,
      isPartOf: { "@id": `${abs(path)}#webpage` },
      mainEntityOfPage: { "@id": `${abs(path)}#webpage` },
      headline: guide.metaTitle,
      alternativeHeadline: guide.title,
      description: guide.metaDescription,
      image: [abs(guide.image.src)],
      datePublished: guide.published,
      dateModified: guide.updated,
      inLanguage: "en-IN",
      wordCount: countWords(guide),
      timeRequired: `PT${guide.readMinutes}M`,
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      about: [
        { "@type": "Thing", name: "Thermal printing" },
        { "@type": "Thing", name: "Mini thermal printer" },
      ],
      articleSection: "Guides",
    },
    // FAQPage is emitted only here, on the URL that owns these exact
    // questions — never duplicated across the site.
    faqPageLd(guide.faqs, path),
  );

  const related = guide.related
    .map((s) => getGuide(s))
    .filter((g): g is Guide => Boolean(g));

  return (
    <Section className="pt-8 md:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ld) }}
      />
      <Container className="max-w-3xl">
        <Breadcrumbs crumbs={crumbs} />

        <article>
          <header className="space-y-4">
            <Eyebrow>Beevo guide</Eyebrow>
            <h1 className="font-display text-[2rem] leading-[1.1] font-semibold tracking-tight text-ink md:text-[2.6rem]">
              {guide.title}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-bold text-ink-faint">
              <span>By the Beevo team</span>
              <span aria-hidden>·</span>
              <span>
                Updated{" "}
                <time dateTime={guide.updated}>
                  {formatGuideDate(guide.updated)}
                </time>
              </span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {guide.readMinutes} min read
              </span>
            </p>
          </header>

          {/* Answer-first summary: what a featured snippet or AI answer lifts. */}
          <Card className="mt-7 border-accent/25 bg-accent-soft/40 p-6">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-accent-deep">
              <Lightbulb className="size-4" aria-hidden />
              The short answer
            </h2>
            <ul className="mt-3.5 space-y-2.5">
              {guide.tldr.map((point) => (
                <li
                  key={point}
                  className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink"
                >
                  <Check
                    className="mt-1 size-4 shrink-0 text-accent-deep"
                    aria-hidden
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="relative mt-7 aspect-[16/9] overflow-hidden rounded-3xl border border-sandline">
            <Image
              src={guide.image.src}
              alt={guide.image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>

          {/* Jump links — real navigation, and a crawlable outline of the page. */}
          <nav aria-label="On this page" className="mt-8">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-faint">
              On this page
            </h2>
            <ol className="mt-3 space-y-1.5">
              {guide.sections.map((section, i) => (
                <li key={section.id} className="flex gap-2.5 text-[14.5px]">
                  <span className="font-mono text-[12px] font-bold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <a
                    href={`#${section.id}`}
                    className="font-semibold text-ink-soft underline-offset-4 hover:text-accent-deep hover:underline"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
              <li className="flex gap-2.5 text-[14.5px]">
                <span className="font-mono text-[12px] font-bold text-accent">
                  {String(guide.sections.length + 1).padStart(2, "0")}
                </span>
                <a
                  href="#faq"
                  className="font-semibold text-ink-soft underline-offset-4 hover:text-accent-deep hover:underline"
                >
                  Frequently asked questions
                </a>
              </li>
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {guide.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="font-display text-[1.45rem] font-semibold leading-tight tracking-tight text-ink md:text-[1.7rem]">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}

            <section id="faq" className="scroll-mt-28">
              <h2 className="font-display text-[1.45rem] font-semibold leading-tight tracking-tight text-ink md:text-[1.7rem]">
                Frequently asked questions
              </h2>
              <div className="mt-4 divide-y divide-sandline rounded-2xl border border-sandline bg-card">
                {guide.faqs.map((faq) => (
                  <div key={faq.q} className="p-5">
                    <h3 className="text-[15px] font-extrabold text-ink">
                      {faq.q}
                    </h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </article>

        <Card className="mt-12 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[17px] font-extrabold text-ink">
              The printer these guides are about
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Beevo Go — 57 mm, ink-free, Bluetooth, ≈160 g. Free shipping across
              India and Cash on Delivery.
            </p>
          </div>
          <Link href="/" className={buttonClasses({ size: "sm" })}>
            See the Beevo Go
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Card>

        {related.length > 0 ? (
          <aside className="mt-10" aria-labelledby="related-guides">
            <h2
              id="related-guides"
              className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-faint"
            >
              Keep reading
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((item) => (
                <Card key={item.slug} className="p-5">
                  <h3 className="text-[15.5px] font-extrabold leading-snug text-ink">
                    <Link
                      href={`/guides/${item.slug}`}
                      className="hover:text-accent-deep"
                    >
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                    {item.summary}
                  </p>
                </Card>
              ))}
            </div>
          </aside>
        ) : null}
      </Container>
    </Section>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-[15.5px] leading-[1.75] text-ink-soft">
          {block.text}
        </p>
      );
    case "h3":
      return (
        <h3 className="pt-2 text-[17px] font-extrabold text-ink">
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft"
            >
              <span
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-3">
          {block.items.map((item, i) => (
            <li
              key={item}
              className="flex gap-3 text-[15px] leading-relaxed text-ink-soft"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-extrabold text-paper">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-hidden rounded-2xl border border-sandline">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-cream/70">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    scope="col"
                    className="px-4 py-3 text-[12.5px] font-extrabold uppercase tracking-wide text-ink-faint"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map(([a, b]) => (
                <tr key={a} className="border-t border-sandline align-top">
                  <th
                    scope="row"
                    className="w-[38%] px-4 py-3 text-[14px] font-bold text-ink"
                  >
                    {a}
                  </th>
                  <td className="px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
                    {b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <p className="rounded-2xl border border-dashed border-sandline bg-cream/50 p-4 text-[14.5px] leading-relaxed text-ink-soft">
          {block.text}
        </p>
      );
  }
}

function countWords(guide: Guide): number {
  const text = [
    guide.title,
    ...guide.tldr,
    ...guide.sections.flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) => {
        switch (b.type) {
          case "p":
          case "h3":
          case "note":
            return [b.text];
          case "list":
          case "steps":
            return b.items;
          case "table":
            return b.rows.flat();
        }
      }),
    ]),
    ...guide.faqs.flatMap((f) => [f.q, f.a]),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}
