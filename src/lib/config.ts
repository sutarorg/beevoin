/**
 * Static store configuration.
 *
 * Scope rule (see README → "Configuration sources"):
 *   - THIS FILE holds identity/brand defaults that are environment-driven and
 *     never change per order: site name, URL, support contact, legal name.
 *   - THE DATABASE (`products`, `store_settings`) holds everything commercial:
 *     price, shipping, inventory, max-per-order, active state, product copy,
 *     dispatch/delivery/replacement policy text.
 *
 * Nothing in this file may be used to price an order.
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
    "Beevo Go is a pocket-size Bluetooth thermal printer that prints notes, labels, lists and QR codes from your phone — completely ink-free. Free shipping across India.",
  supportEmail: process.env.STORE_CONTACT_EMAIL ?? "support@beevo.in",
  supportHours: "Mon–Sat, 10:00–18:00 IST",
  /** Physical/business address supplied via environment for legal pages. */
  address: process.env.STORE_ADDRESS ?? "",
} as const;

/** Default policy copy. Overridable from /admin/settings (store_settings). */
export const policyDefaults = {
  dispatchWindow: "24–48 hours on business days",
  deliveryEstimate: "3–7 business days depending on your pincode",
  replacementWindowDays: 7,
} as const;

/** The storefront slug of the single product Beevo sells. */
export const PRIMARY_PRODUCT_SLUG = "beevo-go";

export const payments = {
  /** Cash on Delivery is always available. */
  cod: true,
  /** Online payments via Razorpay — enabled only when API keys are configured. */
  razorpayEnabled: Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  ),
  /** Public Checkout key — safe for the browser. The secret never leaves the server. */
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
} as const;

export const emailConfig = {
  fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  fromName: process.env.RESEND_FROM_NAME ?? site.name,
  /** Operational notifications (new order, contact message, low stock). */
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
  resendConfigured: Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL,
  ),
} as const;

export function emailFrom(): string {
  if (!emailConfig.fromEmail) return "";
  return emailConfig.fromName
    ? `${emailConfig.fromName} <${emailConfig.fromEmail}>`
    : emailConfig.fromEmail;
}

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  configured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;
