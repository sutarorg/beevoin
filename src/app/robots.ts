import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

/**
 * Crawl policy.
 *
 *   • Private or duplicate-by-nature routes (admin, API, cart, checkout,
 *     order, track) are disallowed AND carry a noindex header, so neither
 *     signal contradicts the other.
 *   • Query-string variants of the storefront (`?utm_…`, share params) are
 *     blocked so crawl budget is spent on canonical URLs.
 *   • AI answer engines are explicitly allowed. Google's own guidance is that
 *     the same indexing applies to AI Overviews and AI Mode, and a meaningful
 *     share of discovery now happens through assistants — blocking them by
 *     accident is a self-inflicted visibility loss for a brand that wants to
 *     be cited.
 */
const PRIVATE_PATHS = [
  "/admin",
  "/admin/",
  "/api/",
  "/cart",
  "/checkout",
  "/order/",
  "/track",
];

const AI_CRAWLERS = [
  "Google-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS, "/*?*utm_", "/*?key=", "/*?order="],
      },
      {
        // Googlebot may fetch images and static assets without restriction.
        userAgent: "Googlebot",
        allow: ["/", "/images/", "/_next/static/"],
        disallow: PRIVATE_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
