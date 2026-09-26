import type { MetadataRoute } from "next";
import { site } from "@/lib/config";
import { GUIDES } from "@/lib/guides";

/**
 * Only canonical, indexable URLs belong here. Cart, checkout, order and track
 * are noindex by design (they are private or duplicate-by-nature), so listing
 * them would send Google a signal that contradicts the page itself.
 *
 * `lastModified` is honest: guides carry their real editorial date rather than
 * "now", because a sitemap that claims every page changed today is ignored.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const newestGuide = GUIDES.reduce(
    (latest, g) => (g.updated > latest ? g.updated : latest),
    GUIDES[0]?.updated ?? "",
  );

  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${site.url}/guides`,
      lastModified: new Date(`${newestGuide}T00:00:00Z`),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...GUIDES.map((guide) => ({
      url: `${site.url}/guides/${guide.slug}`,
      lastModified: new Date(`${guide.updated}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${site.url}/faq`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${site.url}/contact`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.6 },
    { url: `${site.url}/shipping`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.5 },
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${site.url}/terms`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.4 },
  ];
}
