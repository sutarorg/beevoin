/**
 * Central SEO / structured-data helpers.
 *
 * Every JSON-LD graph the site emits is built here so that:
 *
 *   • entity @ids are stable and cross-linked (Organization ← WebSite ← WebPage
 *     ← Product/Article). Google's 2026 systems resolve entities, not strings,
 *     so a consistent @id graph is worth more than repeating the brand name.
 *   • a given schema type is emitted on exactly ONE canonical URL. Duplicated
 *     FAQPage markup across several URLs is the most common cause of rich
 *     results being dropped, so FAQPage lives only on /faq and on the guide
 *     that owns those questions.
 *   • prices, availability, shipping and returns always come from the same
 *     source of truth the checkout uses — mismatched merchant data is a
 *     structured-data penalty risk, not just a warning.
 */
import { policies, site } from "./config";
import type { StorefrontProduct } from "./product-types";

export const ORG_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;
export const PRODUCT_ID = `${site.url}/#product`;

/** Absolute URL for a site-relative path. Schema.org requires absolute URLs. */
export function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Serialise JSON-LD for `dangerouslySetInnerHTML` without breaking out of the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const organizationLd = {
  "@type": ["Organization", "OnlineStore"],
  "@id": ORG_ID,
  name: site.name,
  legalName: site.legalName,
  url: site.url,
  logo: { "@type": "ImageObject", url: abs("/icon.svg"), caption: `${site.name} logo` },
  image: abs("/opengraph-image"),
  slogan: site.tagline,
  description: site.description,
  email: site.supportEmail,
  areaServed: { "@type": "Country", name: "India" },
  currenciesAccepted: "INR",
  paymentAccepted: "UPI, Credit Card, Debit Card, Netbanking, Wallet, Cash on Delivery",
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: site.supportEmail,
      contactType: "customer support",
      areaServed: "IN",
      availableLanguage: ["English", "Hindi"],
      hoursAvailable: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "10:00",
        closes: "18:00",
      },
    },
  ],
};

export const websiteLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: site.name,
  url: site.url,
  inLanguage: "en-IN",
  publisher: { "@id": ORG_ID },
};

/** Shipping + return policy blocks Google expects on a merchant listing. */
const shippingDetailsLd = {
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "INR" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" },
  },
};

const returnPolicyLd = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "IN",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: policies.replacementWindowDays,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
};

/**
 * Product graph built from the authoritative database row. Both the prepaid
 * and the Cash-on-Delivery price are published, so the price range Google
 * shows can never contradict the checkout.
 */
export function productLd(product: StorefrontProduct) {
  const inStock =
    product.stockState === "in_stock" || product.stockState === "low_stock";
  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  // Offers stay quotable for a year; Google drops offers with a stale
  // priceValidUntil, and an absent one is treated as "unknown".
  const priceValidUntil = new Date(Date.now() + 365 * 864e5)
    .toISOString()
    .slice(0, 10);

  const baseOffer = {
    "@type": "Offer",
    url: site.url,
    priceCurrency: product.currency,
    availability,
    itemCondition: "https://schema.org/NewCondition",
    priceValidUntil,
    seller: { "@id": ORG_ID },
    shippingDetails: shippingDetailsLd,
    hasMerchantReturnPolicy: returnPolicyLd,
    eligibleRegion: { "@type": "Country", name: "India" },
  };

  const online = product.priceInPaise / 100;
  const cod = product.codPriceInPaise / 100;

  return {
    "@type": "Product",
    "@id": PRODUCT_ID,
    name: product.name,
    alternateName: "Beevo Go pocket thermal printer",
    sku: product.sku,
    mpn: product.sku,
    category: "Printers > Portable thermal printers",
    description:
      "Beevo Go is a palm-size Bluetooth mini thermal printer for ink-free black-and-white printing of notes, labels, to-do lists, QR codes and simple photos from Android and iOS phones. Approximately 200 DPI, about 160 g, rechargeable 1200 mAh battery, 57 mm thermal paper rolls.",
    url: site.url,
    image:
      product.images.length > 0
        ? product.images.map((img) => abs(img.src))
        : [abs("/opengraph-image")],
    brand: { "@type": "Brand", name: site.name },
    manufacturer: { "@id": ORG_ID },
    material: "ABS plastic",
    color: "White",
    weight: { "@type": "QuantitativeValue", value: 160, unitCode: "GRM" },
    isFamilyFriendly: true,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Printing technology", value: "Direct thermal (ink-free)" },
      { "@type": "PropertyValue", name: "Print resolution", value: "203 DPI (approx. 200 DPI)" },
      { "@type": "PropertyValue", name: "Paper width", value: "57 mm thermal roll" },
      { "@type": "PropertyValue", name: "Connectivity", value: "Bluetooth" },
      { "@type": "PropertyValue", name: "Battery", value: "Rechargeable, approx. 1200 mAh, USB charging" },
      { "@type": "PropertyValue", name: "Compatibility", value: "Android and iOS smartphones" },
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency,
      lowPrice: online.toFixed(2),
      highPrice: cod.toFixed(2),
      offerCount: 2,
      availability,
      offers: [
        { ...baseOffer, price: online.toFixed(2), name: "Prepaid (UPI, card, netbanking)" },
        { ...baseOffer, price: cod.toFixed(2), name: "Cash on Delivery" },
      ],
    },
  };
}

export type Crumb = { name: string; path: string };

/** BreadcrumbList — drives the breadcrumb trail shown in place of a raw URL. */
export function breadcrumbLd(crumbs: Crumb[], pageUrl: string) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${abs(pageUrl)}#breadcrumbs`,
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export function webPageLd({
  path,
  name,
  description,
  crumbs,
}: {
  path: string;
  name: string;
  description: string;
  crumbs?: Crumb[];
}) {
  return {
    "@type": "WebPage",
    "@id": `${abs(path)}#webpage`,
    url: abs(path),
    name,
    description,
    inLanguage: "en-IN",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORG_ID },
    ...(crumbs ? { breadcrumb: { "@id": `${abs(path)}#breadcrumbs` } } : {}),
  };
}

export function faqPageLd(faqs: readonly { q: string; a: string }[], path: string) {
  return {
    "@type": "FAQPage",
    "@id": `${abs(path)}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Wrap one or more schema nodes into a single connected @graph document. */
export function graph(...nodes: unknown[]) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
