/**
 * Static store configuration.
 *
 * Deliberate separation of concerns:
 *
 *   • THIS FILE  — brand identity, support contacts, legal defaults, policy
 *                  copy and provider feature flags. Environment-driven,
 *                  never customer-order data.
 *
 *   • DATABASE   — price, currency, shipping, SKU, inventory, active state,
 *                  images, specifications and max-per-order. See
 *                  `src/lib/services/products.ts`; the `products` table is the
 *                  authoritative commercial source of truth.
 *
 * Anything commercial that used to live here now lives in the database. The
 * only product data left below is `productDefaults`, which exists purely so
 * `npm run db:seed` can create the first row.
 */

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const site = {
  name: "Beevo",
  legalName: process.env.STORE_LEGAL_NAME ?? "Beevo Retail",
  url: siteUrl,
  tagline: "Little prints. Zero ink.",
  description:
    "Beevo Go is a pocket-size Bluetooth thermal printer that prints notes, labels, lists and QR codes from your phone — completely ink-free. ₹999 online or ₹1,299 with Cash on Delivery, with free shipping across India.",
  supportEmail: process.env.STORE_CONTACT_EMAIL ?? "support@beevo.in",
  supportHours: "Mon–Sat, 10:00–18:00 IST",
  // Physical/business address supplied via environment for legal pages.
  address: process.env.STORE_ADDRESS ?? "",
} as const;

/** Default policy copy. Editable at runtime from /admin/settings. */
export const policies = {
  dispatchWindow: "24–48 hours on business days",
  deliveryEstimate: "3–7 business days depending on your pincode",
  replacementWindowDays: 7,
} as const;

export const payments = {
  /** COD becomes available only after its required SMS verification is configured. */
  cod: Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID &&
      (process.env.COD_OTP_TOKEN_SECRET?.length ?? 0) >= 32,
  ),
  /** Online payments via Razorpay — enabled only when API keys are configured. */
  razorpayEnabled: Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  ),
  /** Public Checkout key. Safe to hand to the browser; the secret never is. */
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
} as const;

export const email = {
  fromAddress: process.env.RESEND_FROM_EMAIL ?? "orders@beevo.in",
  fromName: process.env.RESEND_FROM_NAME ?? "Beevo",
  adminNotificationEmail:
    process.env.ADMIN_NOTIFICATION_EMAIL ??
    process.env.STORE_CONTACT_EMAIL ??
    "",
  resendConfigured: Boolean(process.env.RESEND_API_KEY),
} as const;

/** `"Beevo <orders@beevo.in>"` — the RFC 5322 sender Resend expects. */
export function emailSender(): string {
  return `${email.fromName} <${email.fromAddress}>`;
}

/**
 * Seed values for the single Beevo product. Used ONLY by `npm run db:seed`
 * when the `products` table is empty — the running application always reads
 * the database. Image paths match the existing public assets exactly.
 */
export const productDefaults = {
  slug: "beevo-go",
  sku: "BG-GO-01",
  name: "Beevo Go Mini Thermal Printer",
  shortName: "Beevo Go",
  /** ₹999 online in integer paise. */
  priceInPaise: 99_900,
  /** ₹1,299 by Cash on Delivery in integer paise. */
  codPriceInPaise: 129_900,
  currency: "INR",
  maxPerOrder: 5,
  shippingInPaise: 0,
  inventoryQuantity: 0,
  lowStockThreshold: 5,
  shortDescription:
    "Pocket-size Bluetooth thermal printer. Notes, labels, lists and QR codes — completely ink-free.",
  description:
    "Beevo Go is a pocket-size Bluetooth thermal printer that prints notes, labels, lists, to-dos and QR codes straight from your phone. No ink, no cartridges, no refills — just thermal paper rolls. Charges over USB-C and pairs with the free companion app.",
  images: [
    {
      src: "/images/product-1.jpg",
      alt: "Beevo Go mini thermal printer — how it works: select a photo, connect via Bluetooth, load paper and print",
    },
    {
      src: "/images/product-2.jpg",
      alt: "Beevo Go pocket thermal printer, front view",
    },
    {
      src: "/images/product-3.jpg",
      alt: "Beevo Go mini printer printing a photo strip from a smartphone",
    },
    {
      src: "/images/product-4.jpg",
      alt: "Beevo Go portable printer shown with everyday printed moments",
    },
    {
      src: "/images/product-5.jpg",
      alt: "Beevo Go printer in use for labels, notes and journaling prints",
    },
    {
      src: "/images/product-6.jpg",
      alt: "Beevo Go mini thermal printer with printed photos and paper roll",
    },
  ],
  specifications: [
    { label: "Print technology", value: "Direct thermal — no ink or toner" },
    { label: "Paper width", value: "57 mm thermal roll" },
    { label: "Connectivity", value: "Bluetooth 5.0 (Android & iOS)" },
    { label: "Battery", value: "1000 mAh, USB-C charging" },
    { label: "In the box", value: "Printer, starter paper roll, USB-C cable" },
    { label: "Warranty", value: "6 months against manufacturing defects" },
  ],
} as const;
