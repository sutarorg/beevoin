import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site.url}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site.url}/shipping`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
}
