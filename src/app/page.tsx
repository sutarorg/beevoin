import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BatteryCharging,
  Bluetooth,
  Boxes,
  FlameKindling,
  Image as ImageIcon,
  ListChecks,
  Lock,
  Mail,
  NotebookPen,
  PackageSearch,
  Printer,
  QrCode,
  Ruler,
  ShieldCheck,
  Smartphone,
  Tag,
  Undo2,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Accordion } from "@/components/accordion";
import { BuyBox } from "@/components/buy-box";
import { ProductGallery } from "@/components/product-gallery";
import { StickyBuyBar } from "@/components/sticky-buy-bar";
import { VideoCard } from "@/components/video-card";
import {
  Badge,
  Card,
  Container,
  Eyebrow,
  Section,
  SectionTitle,
  StarRating,
  buttonClasses,
} from "@/components/ui";
import { site } from "@/lib/config";
import { guidesByFreshness } from "@/lib/guides";
import {
  breadcrumbLd,
  graph,
  jsonLd,
  productLd,
  webPageLd,
  type Crumb,
} from "@/lib/seo";
import { getStorefrontProduct } from "@/lib/services/products";
import {
  UNAVAILABLE_PRODUCT,
  type StorefrontProduct,
} from "@/lib/product-types";
import {
  DEMO_VIDEO,
  FAQS,
  HERO,
  HOW_IT_WORKS,
  HOW_IT_WORKS_CLOSER,
  IN_THE_BOX,
  REVIEWS,
  SOCIAL_PROOF,
  SPECS,
  SPEC_TICKER,
  USE_CASES,
  VALUE_PROPS,
} from "@/lib/content";
import { formatINR } from "@/lib/format";

const VALUE_ICONS: Record<string, LucideIcon> = {
  NotebookPen,
  Tag,
  ListChecks,
  QrCode,
  Image: ImageIcon,
  FlameKindling,
};

const homeCrumbs: Crumb[] = [{ name: "Home", path: "/" }];

/**
 * The SEO fields edited in /admin/product are published in the document head,
 * as well as in the body. This keeps the Google result in sync with the actual
 * product instead of leaving a hidden, stale copy of the marketing copy.
 */
export async function generateMetadata(): Promise<Metadata> {
  const product = await getStorefrontProduct();
  const title =
    product?.metaTitle?.trim() ||
    "Beevo Go — Ink-Free Pocket Thermal Printer";
  const description =
    product?.metaDescription?.trim() || site.description;

  return {
    title,
    description,
    alternates: { canonical: "/" },
    keywords: [
      "mini thermal printer",
      "pocket printer",
      "portable printer india",
      "bluetooth thermal printer",
      "inkless printer",
      "label printer for phone",
      "57mm thermal printer",
      "beevo go",
    ],
    openGraph: {
      title,
      description,
      url: "/",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Beevo Go ink-free pocket thermal printer",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function HomePage() {
  // Cached read of the single authoritative product row.
  const product = (await getStorefrontProduct()) ?? UNAVAILABLE_PRODUCT;
  // Do not advertise a fallback/unseeded product with a made-up zero price.
  // A product is only advertised to search engines when a real, priced row
  // exists. The fallback product has no price, and inventing one would be a
  // structured-data lie.
  const ld = graph(
    webPageLd({
      path: "/",
      name: "Beevo Go — ink-free pocket thermal printer",
      description: site.description,
      crumbs: homeCrumbs,
    }),
    breadcrumbLd(homeCrumbs, "/"),
    product.id ? productLd(product) : null,
  );
  const guides = guidesByFreshness().slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ld) }}
      />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[480px] rounded-full bg-accent-soft blur-3xl"
        />
        <Container className="relative grid items-center gap-10 pb-12 pt-8 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="order-2 min-w-0 space-y-6 lg:order-1">
            <Eyebrow>{HERO.eyebrow}</Eyebrow>
            <h1 className="font-display text-[2.35rem] leading-[1.06] font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Your notes, labels and memories,{" "}
              <span className="text-accent">in your hand in seconds.</span>
            </h1>
            <p className="max-w-lg text-[15.5px] leading-relaxed text-ink-soft md:text-lg">
              {HERO.subtitle}
            </p>
            <BuyBox />
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <div className="relative">
              <ProductGallery images={product.images} />
              <Badge
                tone="dark"
                className="absolute -top-2.5 left-4 rotate-[-4deg] px-4 py-1.5 text-sm shadow-pop"
              >
                <Printer className="size-3.5" aria-hidden />
                Pocket-size
              </Badge>
            </div>
          </div>
        </Container>

        {/* Spec ticker — kept larger and darker: spec-savvy buyers scan this
            strip, so it must not read as fine print. */}
        <div className="marquee border-y border-dashed border-sandline bg-white/70 py-4">
          <div className="marquee-track gap-0">
            {[0, 1].map((dup) => (
              <div
                key={dup}
                aria-hidden={dup === 1}
                className="flex shrink-0 items-center"
              >
                {SPEC_TICKER.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-3.5 whitespace-nowrap px-5 text-[15px] font-extrabold text-ink"
                  >
                    {item}
                    <span className="size-2 rounded-full bg-accent" aria-hidden />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEMO VIDEO ============ */}
      <section id="demo" className="border-b border-sandline/70 bg-cream/50 py-14 md:py-20">
        <Container className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="order-2 min-w-0 space-y-5 lg:order-1">
            <Eyebrow>Seeing is believing</Eyebrow>
            <SectionTitle>Watch it print. No ink, no cartridges, no catch.</SectionTitle>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
              People don&apos;t fully believe &ldquo;no ink&rdquo; until they see
              it happen. Here&apos;s fifteen unedited seconds of the Beevo Go
              doing exactly what it says: you tap print on your phone, and a
              crisp black-and-white print rolls out — powered by nothing but
              heat.
            </p>
            <ul className="space-y-2.5 pt-1">
              {[
                { icon: Smartphone, label: "Works with iPhone & Android" },
                { icon: BadgeCheck, label: "No subscription, no ink ever — only paper" },
                { icon: Undo2, label: "7-day replacement promise" },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2.5 text-[14.5px] font-bold text-ink"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf">
                    <item.icon className="size-3.5" aria-hidden />
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 mx-auto w-full max-w-[300px] md:max-w-[340px] lg:order-2">
            <VideoCard
              youtubeId={DEMO_VIDEO.youtubeId}
              title={DEMO_VIDEO.title}
              poster={DEMO_VIDEO.poster}
              posterAlt={DEMO_VIDEO.posterAlt}
              duration={DEMO_VIDEO.duration}
            />
          </div>
        </Container>
      </section>

      {/* ============ VALUE PROPS ============ */}
      <Section id="features">
        <Container>
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Why you&apos;ll reach for it daily</Eyebrow>
            <SectionTitle>
              One little printer, a hundred little prints
            </SectionTitle>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Beevo Go turns the digital stuff on your phone into small, useful
              paper. Here&apos;s what people actually use it for.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUE_PROPS.map((prop) => {
              const Icon = VALUE_ICONS[prop.icon];
              return (
                <Card key={prop.title} className="p-6 transition-shadow hover:shadow-pop">
                  <span className="mb-4 inline-flex rounded-2xl bg-accent-soft p-3 text-accent-deep">
                    <Icon className="size-5.5" aria-hidden />
                  </span>
                  <h3 className="text-[17px] font-extrabold text-ink">
                    {prop.title}
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">
                    {prop.body}
                  </p>
                </Card>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* ============ HOW IT WORKS ============ */}
      <Section id="how-it-works" className="bg-cream/70">
        <Container>
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Up and printing in a minute</Eyebrow>
            <SectionTitle>How it works</SectionTitle>
          </div>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.step} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-bold text-paper">
                    {step.step}
                  </span>
                  <span
                    aria-hidden
                    className="hidden h-px flex-1 border-t border-dashed border-ink-faint/50 lg:block"
                  />
                </div>
                <h3 className="mt-4 text-[16px] font-extrabold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          {/* Speed-to-value closer — turns the education block into a
              conversion moment instead of a detour. */}
          <p className="mt-10 flex flex-wrap items-center gap-2 text-[15px] font-bold text-ink">
            <Zap className="size-4.5 shrink-0 text-accent" aria-hidden />
            {HOW_IT_WORKS_CLOSER.line}{" "}
            <a
              href="#hero-cta"
              className="text-accent-deep underline-offset-4 hover:underline"
            >
              {HOW_IT_WORKS_CLOSER.cta} →
            </a>
          </p>
        </Container>
      </Section>

      {/* ============ USE CASES ============ */}
      <Section>
        <Container>
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Made for your everyday</Eyebrow>
            <SectionTitle>Where Beevo Go fits right in</SectionTitle>
          </div>
          <div className="mt-10 space-y-12">
            {USE_CASES.map((use, i) => (
              <article
                key={use.tag}
                className="grid items-center gap-7 md:grid-cols-2 md:gap-12"
              >
                <div
                  className={
                    i % 2 === 1 ? "relative md:order-2" : "relative"
                  }
                >
                  <div className="relative aspect-square overflow-hidden rounded-3xl border border-sandline shadow-lift">
                    <Image
                      src={use.image}
                      alt={use.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 540px"
                      className="object-cover"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  </div>
                </div>
                <div className={i % 2 === 1 ? "md:order-1" : ""}>
                  <Badge tone="accent">{use.tag}</Badge>
                  <h3 className="mt-3.5 font-display text-[1.55rem] font-semibold leading-snug tracking-tight text-ink md:text-3xl">
                    {use.title}
                  </h3>
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
                    {use.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* ============ REVIEWS ============ */}
      <Section id="reviews">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <Eyebrow>Word from early printers</Eyebrow>
              <SectionTitle>Loved by note-takers, label-makers and journal-keepers</SectionTitle>
            </div>
            {/* Aggregate rating summary. Renders from SOCIAL_PROOF — replace
                with real review data before launch (see lib/content.ts). */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-sandline bg-card px-5 py-3.5 shadow-lift">
              <p className="font-display text-[2rem] font-bold leading-none text-ink">
                {SOCIAL_PROOF.rating.toFixed(1)}
              </p>
              <div>
                <StarRating rating={SOCIAL_PROOF.rating} />
                <p className="mt-1 text-[12.5px] font-bold text-ink-faint">
                  {SOCIAL_PROOF.reviewCount} verified reviews
                </p>
              </div>
            </div>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REVIEWS.map((review) => (
              <Card key={review.name} className="flex flex-col p-6">
                <div className="flex items-center justify-between gap-3">
                  <StarRating rating={review.rating} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-2.5 py-1 text-[11px] font-bold text-leaf">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Verified buyer
                  </span>
                </div>
                <h3 className="mt-3.5 text-[15.5px] font-extrabold leading-snug text-ink">
                  {review.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  {review.body}
                </p>
                <div className="mt-auto border-t border-dashed border-sandline pt-3.5 text-[12.5px] leading-relaxed">
                  <p className="font-bold text-ink">
                    {review.name} · {review.city}
                  </p>
                  <p className="mt-0.5 font-semibold text-ink-faint">{review.tag}</p>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* ============ PRICE / RECEIPT ============ */}
      <Section id="pricing" className="bg-ink py-16 text-paper md:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-5">
            <Eyebrow className="text-paper/60 [&>span]:bg-accent">
              Choose how you pay.
            </Eyebrow>
            <h2 className="font-display text-[1.9rem] font-semibold leading-tight tracking-tight md:text-4xl">
              {formatINR(product.priceInPaise)} online. {formatINR(product.codPriceInPaise)} on COD.
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-paper/70">
              Pay online to get the best price, or choose Cash on Delivery when
              it suits you. Every price is inclusive of taxes, with free
              doorstep delivery anywhere in India.
            </p>
            <ul className="space-y-2.5 pt-1 text-sm font-bold text-paper/85">
              {[
                "Free shipping to every serviceable pincode",
                `Pay online: ${formatINR(product.priceInPaise)} · COD: ${formatINR(product.codPriceInPaise)}`,
                "7-day replacement promise for defects",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <ShieldCheck className="size-4.5 shrink-0 text-accent" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="fade-up rounded-t-2xl bg-white px-7 pb-8 pt-7 font-mono text-ink shadow-pop">
              <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-ink-faint">
                Beevo · Order preview
              </p>
              <div className="dashed-rule my-5" />
              <div className="space-y-2.5 text-[15px]">
                <p className="flex justify-between gap-4">
                  <span>
                    {product.shortName} × 1<span className="block text-xs text-ink-faint">Ink-free pocket printer</span>
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatINR(product.priceInPaise)} online
                  </span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Cash on Delivery × 1<span className="block text-xs text-ink-faint">Pay at your doorstep</span></span>
                  <span className="font-bold tabular-nums">
                    {formatINR(product.codPriceInPaise)}
                  </span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Shipping</span>
                  <span
                    className={
                      product.shippingInPaise === 0
                        ? "font-bold text-leaf"
                        : "font-bold tabular-nums"
                    }
                  >
                    {product.shippingInPaise === 0
                      ? "FREE"
                      : formatINR(product.shippingInPaise)}
                  </span>
                </p>
                <p className="flex justify-between gap-4 text-[13px] text-ink-faint">
                  <span>GST</span>
                  <span>Included in price</span>
                </p>
              </div>
              <div className="dashed-rule my-5" />
              <p className="flex items-baseline justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-ink-soft">
                  Total
                </span>
                <span className="font-display text-3xl font-bold tabular-nums">
                  {formatINR(product.priceInPaise + product.shippingInPaise)} online
                </span>
              </p>
              <Link
                href="/checkout"
                className={buttonClasses({ className: "mt-6 w-full", size: "lg" })}
              >
                <Zap className="size-4.5" aria-hidden />
                Buy online — {formatINR(product.priceInPaise)}
              </Link>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-ink-soft">
                <Lock className="size-3.5 shrink-0 text-leaf" aria-hidden />
                Secure checkout
              </p>
              {/* Payment-method reassurance — names the rails Indian buyers
                  look for instead of making them click to find out. */}
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {["UPI", "Cards", "Netbanking", "Wallets", "COD"].map((method) => (
                  <span
                    key={method}
                    className="rounded-md border border-sandline bg-cream px-2.5 py-1 font-mono text-[11px] font-bold text-ink-soft"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
            <div className="receipt-edge" aria-hidden />
          </div>
        </Container>
      </Section>

      {/* ============ SPECS + IN THE BOX ============ */}
      <Section id="specs">
        <Container className="grid gap-11 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>Verified specifications</Eyebrow>
            <SectionTitle className="mt-3">The specs, straight up</SectionTitle>
            <p className="mt-3 max-w-md text-[14.5px] text-ink-soft">
              Every number below comes from the manufacturer&apos;s published
              specifications. Figures marked ≈ are approximate.
            </p>
            <dl className="mt-7 overflow-hidden rounded-2xl border border-sandline bg-card">
              {SPECS.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-baseline justify-between gap-6 border-b border-sandline/60 px-5 py-3.5 last:border-0 odd:bg-cream/40"
                >
                  <dt className="shrink-0 text-[13.5px] font-bold text-ink-faint">
                    {spec.label}
                  </dt>
                  <dd className="text-right text-[14px] font-bold text-ink">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div id="box">
            <Eyebrow>What&apos;s in the box</Eyebrow>
            <SectionTitle className="mt-3">Open it up</SectionTitle>
            <div className="relative mt-7 aspect-square overflow-hidden rounded-3xl border border-sandline shadow-lift">
              <Image
                src="/images/box-contents.jpg"
                alt="Beevo Go box contents: the printer, USB charging cable, a thermal paper roll and the quick-start guide"
                fill
                sizes="(max-width: 768px) 100vw, 540px"
                className="object-cover"
                loading="lazy"
              />
            </div>
            <Card className="mt-5 p-6">
              <ul className="space-y-2.5">
                {IN_THE_BOX.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-[15px] font-bold text-ink"
                  >
                    <Boxes className="size-4.5 shrink-0 text-accent" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-dashed border-sandline pt-3.5 text-[12.5px] leading-relaxed text-ink-faint">
                Box contents are as supplied by the manufacturer for this batch.
                If your package ever differs from this list, contact support and
                we&apos;ll make it right.
              </p>
            </Card>
          </div>
        </Container>
      </Section>

      {/* ============ TRUST ============ */}
      <Section className="bg-cream/70">
        <Container>
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Shop with confidence</Eyebrow>
            <SectionTitle>Boring reliability, by design</SectionTitle>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Lock,
                title: "Secure checkout",
                body: "Payments are processed by PCI-DSS compliant gateways; we never see or store your card details.",
              },
              {
                icon: PackageSearch,
                title: "Track every step",
                body: "Every order gets a tracking timeline from confirmed to delivered, plus email updates at each stage.",
              },
              {
                icon: Undo2,
                title: "7-day replacement",
                body: "Damaged, defective or not-as-described? Contact us within 7 days of delivery for replacement support.",
              },
              {
                icon: Mail,
                title: "Real human support",
                body: `Write to ${site.supportEmail} — a person replies within one business day, not a bot loop.`,
              },
            ].map((item) => (
              <Card key={item.title} className="p-6">
                <item.icon className="size-6 text-accent-deep" aria-hidden />
                <h3 className="mt-3.5 text-[16px] font-extrabold text-ink">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* ============ FAQ PREVIEW ============ */}
      <Section>
        <Container className="grid gap-9 lg:grid-cols-[0.9fr_1.4fr]">
          <div className="space-y-3">
            <Eyebrow>Good questions</Eyebrow>
            <SectionTitle>Everything people ask before buying</SectionTitle>
            <p className="text-[14.5px] leading-relaxed text-ink-soft">
              Honest answers about printing, compatibility, charging and delivery.{" "}
              <Link
                href="/faq"
                className="font-bold text-accent-deep underline-offset-4 hover:underline"
              >
                See all FAQs →
              </Link>
            </p>
            <div className="hidden gap-3 pt-3 lg:flex">
              <Badge tone="neutral">
                <Bluetooth className="size-3.5" aria-hidden /> Bluetooth
              </Badge>
              <Badge tone="neutral">
                <BatteryCharging className="size-3.5" aria-hidden /> Rechargeable
              </Badge>
              <Badge tone="neutral">
                <Weight className="size-3.5" aria-hidden /> ≈160 g
              </Badge>
              <Badge tone="neutral">
                <Ruler className="size-3.5" aria-hidden /> 57 mm paper
              </Badge>
            </div>
          </div>
          <Accordion items={FAQS.slice(0, 6)} />
        </Container>
      </Section>

      {/* ============ GUIDES ============ */}
      <Section className="bg-cream/70">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-3">
              <Eyebrow>Before you buy, or after</Eyebrow>
              <SectionTitle>Learn the little printer properly</SectionTitle>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                Honest, practical guides to thermal printing — how it works,
                which paper to buy, how to pair it, and what people actually
                print six months in.
              </p>
            </div>
            <Link
              href="/guides"
              className="text-sm font-bold text-accent-deep underline-offset-4 hover:underline"
            >
              All guides →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {guides.map((guide) => (
              <Card key={guide.slug} className="flex flex-col p-6">
                <h3 className="text-[16.5px] font-extrabold leading-snug text-ink">
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="hover:text-accent-deep"
                  >
                    {guide.title}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-soft">
                  {guide.summary}
                </p>
                <p className="mt-3 text-[12px] font-bold text-ink-faint">
                  {guide.readMinutes} min read
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <StickyBuyBar />
    </>
  );
}
