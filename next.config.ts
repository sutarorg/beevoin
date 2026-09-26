import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The Content-Security-Policy is built from the origins this app actually
 * talks to, so it is worth keeping in sync if you add a third-party script:
 *
 *   • checkout.razorpay.com / api.razorpay.com / lumberjack.razorpay.com
 *       Razorpay Checkout loads its script and iframes from these.
 *   • <your-project>.supabase.co
 *       Supabase Auth token refresh, from the browser.
 *   • fonts.googleapis.com / fonts.gstatic.com
 *       next/font self-hosts the font files at build time, but the stylesheet
 *       origins are allowed so a font fallback never hard-fails.
 *   • va.vercel-scripts.com
 *       Vercel Analytics uses this only for its development diagnostic script;
 *       deployed projects load /_vercel/insights from the same origin.
 *
 * `'unsafe-inline'` is required for scripts because Next.js injects inline
 * bootstrap/flight payloads and Razorpay Checkout injects inline handlers.
 * Removing it needs per-request nonces threaded through proxy.ts and every
 * inline <script>; that is a deliberate, documented trade-off rather than an
 * oversight.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://va.vercel-scripts.com",
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com https://va.vercel-scripts.com${
    supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}` : ""
  }`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Only meaningful over HTTPS; browsers ignore it on http://localhost.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Trailing-slash URLs are a classic duplicate-content source; Next.js
  // redirects /faq/ → /faq with this off, which keeps one canonical form.
  trailingSlash: false,
  images: {
    // AVIF first, WebP second: both are far smaller than the source JPEG,
    // which is what LCP on a product page is actually made of.
    formats: ["image/avif", "image/webp"],
    // Optimised variants are immutable, so let the CDN keep them for a year.
    minimumCacheTTL: 31_536_000,
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
  },
  experimental: {
    // Only the icons actually imported are bundled, rather than the whole
    // lucide barrel — smaller JS payload, better INP on mobile.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Static, fingerprinted product imagery — safe to cache hard.
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Private or duplicate-by-nature routes. These are already disallowed
        // in robots.txt and carry page-level noindex metadata; the header
        // makes the signal unambiguous for every crawler, including ones that
        // fetch a URL directly without reading robots.txt first.
        source: "/:path(cart|checkout|track)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
      {
        source: "/order/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // The admin panel and every API route must never be cached by a CDN
        // or shared proxy.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
