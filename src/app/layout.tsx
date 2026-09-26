import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import { CartProvider } from "@/components/cart-store";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/lib/config";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹1,499 | Beevo",
    template: "%s · Beevo",
  },
  description: site.description,
  keywords: [
    "mini thermal printer",
    "pocket printer india",
    "bluetooth printer",
    "inkless printer",
    "label printer",
    "beevo go",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹1,499",
    description: site.description,
    images: [{ url: "/images/og.jpg", width: 1200, height: 630, alt: "Beevo Go mini thermal printer printing a paper strip" }],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beevo Go · Ink-Free Pocket Thermal Printer — ₹1,499",
    description: site.description,
    images: ["/images/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F0",
  width: "device-width",
  initialScale: 1,
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/images/og.jpg`,
  contactPoint: {
    "@type": "ContactPoint",
    email: site.supportEmail,
    contactType: "customer support",
    areaServed: "IN",
    availableLanguage: ["English", "Hindi"],
  },
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
        />
        <CartProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
