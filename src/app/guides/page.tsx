import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Card,
  Container,
  Eyebrow,
  Section,
  SectionTitle,
  buttonClasses,
} from "@/components/ui";
import { site } from "@/lib/config";
import { formatGuideDate, guidesByFreshness } from "@/lib/guides";
import {
  ORG_ID,
  abs,
  breadcrumbLd,
  graph,
  jsonLd,
  webPageLd,
  type Crumb,
} from "@/lib/seo";

const PATH = "/guides";
const TITLE = "Mini thermal printer guides";
const DESCRIPTION =
  "Practical, jargon-free guides to pocket thermal printers: how ink-free printing works, which 57 mm paper to buy, Bluetooth setup and troubleshooting, and what to print.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: PATH,
    title: `${TITLE} · Beevo`,
    description: DESCRIPTION,
  },
};

const crumbs: Crumb[] = [
  { name: "Home", path: "/" },
  { name: "Guides", path: PATH },
];

export default function GuidesHubPage() {
  const guides = guidesByFreshness();

  const ld = graph(
    webPageLd({ path: PATH, name: TITLE, description: DESCRIPTION, crumbs }),
    breadcrumbLd(crumbs, PATH),
    {
      "@type": "CollectionPage",
      "@id": `${abs(PATH)}#collection`,
      url: abs(PATH),
      name: TITLE,
      description: DESCRIPTION,
      isPartOf: { "@id": `${abs(PATH)}#webpage` },
      publisher: { "@id": ORG_ID },
      mainEntity: {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: guides.length,
        itemListElement: guides.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: abs(`/guides/${g.slug}`),
          name: g.title,
        })),
      },
    },
  );

  const [featured, ...rest] = guides;

  return (
    <Section className="pt-8 md:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ld) }}
      />
      <Container>
        <Breadcrumbs crumbs={crumbs} />

        <div className="max-w-2xl space-y-3">
          <Eyebrow>
            <BookOpen className="size-3.5" aria-hidden /> Beevo guides
          </Eyebrow>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Everything worth knowing about mini thermal printers
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            We sell one product — a pocket thermal printer — so these guides are
            written from actually living with the thing: what the paper does in
            an Indian summer, why a print comes out blank, which roll to buy, and
            what people still print six months later. No filler, and no advice we
            would not give a friend before they spent ₹999.
          </p>
        </div>

        {/* Featured guide */}
        <Card className="mt-9 overflow-hidden md:grid md:grid-cols-[1.1fr_1fr]">
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-64">
            <Image
              src={featured.image.src}
              alt={featured.image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 560px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
            <Eyebrow>Most recently updated</Eyebrow>
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
              <Link
                href={`/guides/${featured.slug}`}
                className="hover:text-accent-deep"
              >
                {featured.title}
              </Link>
            </h2>
            <p className="text-[14.5px] leading-relaxed text-ink-soft">
              {featured.summary}
            </p>
            <GuideMeta
              updated={featured.updated}
              readMinutes={featured.readMinutes}
            />
            <Link
              href={`/guides/${featured.slug}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Read the guide
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Card>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((guide) => (
            <Card key={guide.slug} className="flex flex-col overflow-hidden">
              <div className="relative aspect-[16/10]">
                <Image
                  src={guide.image.src}
                  alt={guide.image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-5">
                <h2 className="text-[17px] font-extrabold leading-snug text-ink">
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="hover:text-accent-deep"
                  >
                    {guide.title}
                  </Link>
                </h2>
                <p className="flex-1 text-[14px] leading-relaxed text-ink-soft">
                  {guide.summary}
                </p>
                <GuideMeta
                  updated={guide.updated}
                  readMinutes={guide.readMinutes}
                />
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[17px] font-extrabold text-ink">
              Ready to print something?
            </h2>
            <p className="mt-1 text-[14px] text-ink-soft">
              {site.tagline} Free shipping across India, Cash on Delivery
              available.
            </p>
          </div>
          <Link href="/" className={buttonClasses({ size: "sm" })}>
            See the Beevo Go
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Card>
      </Container>
    </Section>
  );
}

function GuideMeta({
  updated,
  readMinutes,
}: {
  updated: string;
  readMinutes: number;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-ink-faint">
      <span>Updated {formatGuideDate(updated)}</span>
      <span className="flex items-center gap-1.5">
        <Clock className="size-3.5" aria-hidden />
        {readMinutes} min read
      </span>
    </p>
  );
}
