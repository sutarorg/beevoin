/**
 * Central store configuration.
 * Business-contact details are environment-driven so the same codebase can be
 * reused across environments without hard-coding legal/contact information.
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
    "Beevo Go is a pocket-size Bluetooth thermal printer that prints notes, labels, lists and QR codes from your phone — completely ink-free. ₹1,499 with free shipping across India.",
  supportEmail: process.env.STORE_CONTACT_EMAIL ?? "support@beevo.in",
  supportHours: "Mon–Sat, 10:00–18:00 IST",
  // Physical/business address supplied via environment for legal pages.
  address: process.env.STORE_ADDRESS ?? "",
} as const;

export const product = {
  id: "beevo-go",
  sku: "BG-GO-01",
  name: "Beevo Go Mini Thermal Printer",
  shortName: "Beevo Go",
  /** Price in paise — single source of truth used by checkout + orders. */
  priceInPaise: 149900,
  currency: "INR" as const,
  maxPerOrder: 5,
  /** Free shipping store policy (₹0). */
  shippingInPaise: 0,
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
  ] as const,
} as const;

export const policies = {
  /** Store shipping policy. */
  dispatchWindow: "24–48 hours on business days",
  deliveryEstimate: "3–7 business days depending on your pincode",
  replacementWindowDays: 7,
} as const;

export const payments = {
  /** Cash on Delivery is always available. */
  cod: true,
  /** Online payments via Razorpay — enabled only when API keys are configured. */
  razorpayEnabled: Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  ),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
} as const;

export const email = {
  from: process.env.EMAIL_FROM ?? "Beevo <orders@beevo.in>",
  resendConfigured: Boolean(process.env.RESEND_API_KEY),
} as const;
