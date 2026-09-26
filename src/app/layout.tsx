import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { CartProvider } from "@/components/cart-store";
import { SiteShell } from "@/components/site-shell";
import { site } from "@/lib/config";
import { graph, jsonLd, organizationLd, websiteLd } from "@/lib/seo";
import { getStorefrontProduct } from "@/lib/services/products";
import { UNAVAILABLE_PRODUCT } from "@/lib/product-types";
import "./globals.css";

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹999 online | Beevo",
    template: "%s · Beevo",
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.name,
  category: "shopping",
  keywords: [
    "mini thermal printer",
    "pocket printer india",
    "bluetooth printer",
    "inkless printer",
    "label printer",
    "beevo go",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹999 online",
    description: site.description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Beevo Go ink-free pocket thermal printer" }],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹999 online",
    description: site.description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F0",
  width: "device-width",
  initialScale: 1,
};

/**
 * Site-wide entity graph. Organization and WebSite are declared once, here,
 * with stable @ids that every other page references instead of repeating —
 * which is what lets Google resolve one Beevo entity rather than several.
 */
const siteGraph = graph(organizationLd, websiteLd);

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Cached single-product read (tag: "product"). Storefront visitors never
  // trigger an uncached query; checkout always re-reads authoritative data.
  const product = (await getStorefrontProduct()) ?? UNAVAILABLE_PRODUCT;

  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(siteGraph) }}
        />
        <CartProvider product={product}>
          <SiteShell>{children}</SiteShell>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
