# Beevo SEO — what was built, and what only you can do

Last reviewed: **26 September 2026**

This document has two halves. Part A records what is now implemented in the
codebase and why. Part B is the off-site work that no amount of code can do for
you — and, honestly, it is the half that decides whether the site reaches page
one.

---

## 0. The 2026 search landscape this was built against

Research basis: Google's own Search Central guidance plus the pattern of
confirmed 2026 updates (the January core/quality update, the March and June
core updates, and the **August 2026 spam update**), as reported by Search
Engine Journal, Quantifi Media, ClickRank and Grayline Digital.

What actually moves rankings right now:

| Signal | What changed | How the site answers it |
| --- | --- | --- |
| **Helpful, experience-led content** | The 2026 updates escalated E-E-A-T, with explicit weight on first-hand experience and originality. Summarised, generic or mass-produced pages lost ground. | `/guides` — five long-form guides written from real product knowledge, with honest limitations stated (monochrome, 200 DPI, prints fade in heat). No filler pages. |
| **Topical authority over single pages** | Google increasingly evaluates how well a *site* covers a subject, not how well one URL matches a keyword. | A genuine cluster: product page ↔ guides hub ↔ five interlinked guides ↔ FAQ, all about one subject. |
| **Intent matching, not keyword matching** | Semantic intent detection decides relevance before ranking. Keyword-stuffed pages are filtered out earlier. | Each guide targets one intent — informational ("what is…"), commercial ("how to choose…"), troubleshooting ("why won't it connect…"), inspirational ("what to print"). The home page keeps the transactional intent. |
| **AI Overviews / AI Mode visibility** | Google states the same SEO fundamentals apply; the site must be indexable and eligible, and answer-first content is what gets cited. | Every guide opens with a "short answer" block; headings are phrased as real questions; FAQ blocks are concise and quotable; AI crawlers are explicitly allowed in `robots.txt`. |
| **Core Web Vitals, especially INP** | INP ≤ 200 ms is the target; slow interactive elements now hurt more than slow loads. | 2 MB PNGs replaced with ~150 KB JPEGs, AVIF/WebP conversion enabled, immutable caching, `optimizePackageImports` for lucide, guides pre-rendered as static HTML. |
| **Spam / scaled content (Aug 2026)** | Mass-produced pages built only to catch traffic are demoted. | Five substantial guides, not fifty thin ones. No doorway pages, no auto-generated location or keyword variants. |
| **Structured data as an interpretation aid** | Google's AI models use schema to classify intent and context, and cross-check merchant claims. | A single connected `@graph` per page with stable `@id`s, merchant-grade Product/Offer data, breadcrumbs, and FAQPage on exactly one URL. |

Deliberately **not** done, because it is what gets sites penalised: fake
reviews or `aggregateRating` markup, invented test data, a page per long-tail
keyword variant, hidden keyword text, or blog posts published for volume.

---

## Part A — what is implemented

### A1. Crawling and indexing

- `src/app/robots.ts` — allows the storefront and guides; disallows admin, API,
  cart, checkout, order and track; blocks `utm_` and lookup-key query variants
  so crawl budget goes to canonical URLs; explicitly allows Googlebot's asset
  fetching and the major AI crawlers (`Google-Extended`, `GPTBot`,
  `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, `Applebot-Extended`, `CCBot`).
- `src/app/sitemap.ts` — canonical, indexable URLs only, with honest
  `lastModified` dates taken from each guide's real editorial date.
- `next.config.ts` — `X-Robots-Tag: noindex` headers on cart/checkout/track,
  order and API routes, so the header, the robots rules and the page metadata
  all say the same thing. `trailingSlash: false` keeps one canonical URL form.
- Canonical URLs on every indexable page via `alternates.canonical`.

### A2. Structured data (`src/lib/seo.ts`)

One helper module builds every JSON-LD graph, so entities stay consistent:

- `Organization` + `OnlineStore` and `WebSite`, declared once in the root
  layout with stable `@id`s (`/#organization`, `/#website`); every other page
  references those `@id`s instead of repeating the brand.
- `Product` with `AggregateOffer` covering **both** the prepaid and the Cash on
  Delivery price, `priceValidUntil`, `shippingDetails` (free, 1–2 day handling,
  3–7 day transit, India) and `hasMerchantReturnPolicy` (7-day replacement) —
  the merchant fields Google expects before it will show a rich product result.
  Built from the authoritative database row, so it can never contradict
  checkout. It is emitted only when a real priced product row exists.
- `BreadcrumbList` on every sub-page, always paired with a **visible**
  breadcrumb trail (`src/components/breadcrumbs.tsx`).
- `Article` on each guide with `datePublished`, `dateModified`, `wordCount`
  and `timeRequired`.
- `FAQPage` on `/faq` and on each guide, for the questions that URL owns —
  never duplicated across URLs, which is the usual reason FAQ rich results
  silently disappear.

### A3. Content — the topical cluster

`src/lib/guides.ts` holds the guide library as structured data; two routes
render it (`/guides`, `/guides/[slug]`), pre-rendered at build time.

| URL | Primary intent |
| --- | --- |
| `/guides/what-is-a-mini-thermal-printer` | Informational — how ink-free printing works |
| `/guides/mini-thermal-printer-buying-guide-india` | Commercial investigation — how to choose one |
| `/guides/thermal-paper-guide` | Informational — 57 mm rolls, fading, storage, BPA |
| `/guides/connect-mini-printer-to-phone` | Troubleshooting — Bluetooth pairing on Android/iOS |
| `/guides/things-to-print-with-a-mini-printer` | Inspirational — 30 practical uses |

Each guide has: an answer-first summary box, a jump-link outline, question-style
`<h2>`s, comparison tables, an FAQ block, related-guide links and a link back to
the product. Internal linking runs product ↔ hub ↔ guide ↔ guide, so authority
circulates instead of dead-ending.

**To add a guide:** append an entry to `GUIDES` in `src/lib/guides.ts`. The
route, sitemap entry, schema, footer link and hub card all follow automatically.

### A4. On-page and accessibility

- Every page now has exactly one `<h1>`. (The FAQ and legal pages previously
  led with an `<h2>` — a real defect, now fixed via `SectionTitle as="h1"`.)
- `lang="en-IN"`, which matches the market and the currency.
- Descriptive, truthful `alt` text on every image, rewritten to describe the
  image that is actually served.
- Metadata titles under ~60 characters and descriptions at 140–160 characters,
  so neither is truncated in the result.

### A5. Performance / Core Web Vitals

- Product photography re-encoded from ~2 MB PNGs to ~150 KB JPEGs
  (`public/images/`), and Next.js now serves AVIF/WebP derivatives.
- `Cache-Control: public, max-age=31536000, immutable` on `/images/*`.
- `optimizePackageImports` for `lucide-react` — less JS, better INP.
- Guides are fully static (`generateStaticParams`, `dynamicParams = false`).
- Fonts remain system stacks: zero render-blocking font requests.

Verify after deploying: PageSpeed Insights (mobile), targeting LCP < 2.5 s,
INP < 200 ms, CLS < 0.1.

---

## Part B — the work that code cannot do

Ranking on page one for "mini thermal printer" in India is not won in the
repository. In rough order of impact:

1. **Set `NEXT_PUBLIC_SITE_URL`** to the real production origin in every
   environment. Every canonical URL, sitemap entry and schema `@id` derives
   from it. Getting this wrong invalidates everything above.
2. **Google Search Console** — verify the domain (set `GOOGLE_SITE_VERIFICATION`
   or use DNS), submit `/sitemap.xml`, and check the Rich Results and Merchant
   listings reports after the first crawl.
3. **Google Merchant Center** — for a single-product store in India, free
   product listings and Shopping surfaces are usually a bigger traffic source
   than the blue links. The Product schema already meets the data requirements.
4. **Google Business Profile**, if there is a physical presence. Consistent
   name/address/phone, and reviews.
5. **Real reviews.** Collect genuine, verified customer reviews and then — and
   only then — add `Review`/`AggregateRating` markup for the stars. Fabricated
   ratings are a manual-action risk, which is why none are marked up today.
6. **Links and brand mentions.** In 2026 these are judged on trust and topical
   relevance, not volume. Product reviews from Indian tech/stationery
   publications, student and bullet-journal communities, and genuine press
   coverage. No paid link schemes, no PBNs — the August 2026 spam update was
   aimed squarely at those.
7. **Keep the guides alive.** Revisit each guide every 3–6 months: refresh
   prices, add what customer emails reveal people actually ask, and update the
   `updated` field. Freshness is a trust signal on topics where accuracy
   changes.
8. **Watch the right numbers.** Impressions and average position in Search
   Console over *weeks*, not days. Query-level movement matters; daily rank
   noise does not.

### Honest expectation setting

No implementation guarantees page one. What this work does is remove every
technical and structural reason for Google *not* to rank the site, and give it
substantially more relevant surface area to rank. Realistically: a new domain
should expect a few weeks to be crawled and indexed properly, and a few months
of accumulating trust and links before competitive head terms move. Long-tail
guide queries ("why is my mini printer printing blank", "57 mm thermal paper
fading") will land first — which is exactly how a topical cluster is supposed
to mature.
