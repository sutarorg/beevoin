# Product photography

These image files are referenced by the storefront but are **not** in the
repository — they are your own product photos, and no placeholder or stock
imagery ships in their place. Until you add them, the gallery and the
lifestyle sections render a neutral "Photo coming soon" tile instead of a
broken image, so the store still works and still sells.

Drop the files into this folder (`public/images/`) with exactly these names:

| File | Used on | Recommended |
| --- | --- | --- |
| `product-1.jpg` | Product gallery (first/LCP image), cart, checkout, sticky bar | 1200 × 1200, square |
| `product-2.jpg` … `product-6.jpg` | Product gallery | 1200 × 1200, square |
| `use-study.jpg` | Home page — "Study notes" section | 1080 × 1080, square |
| `use-labels.jpg` | Home page — "Labels" section | 1080 × 1080, square |
| `use-journal.jpg` | Home page — "Journalling" section | 1080 × 1080, square |
| `product-printing.jpg` | Home page — "Printing" section | 1080 × 1080, square |
| `box-contents.jpg` | Home page — "What's in the box" | 1080 × 1080, square |
| `og.jpg` | Social share card (OpenGraph / Twitter) | 1200 × 630, landscape |

Tips:

- Keep each file under ~300 KB. `next/image` resizes and serves modern
  formats automatically, but the source still has to be downloaded once.
- Shoot on a plain, light background to match the storefront's paper-and-ink
  palette.
- The alt text lives in `src/lib/content.ts` (`PRODUCT_IMAGES` and `USE_CASES`).
  If your photos show something different, update the alt text with them —
  it is read aloud by screen readers and indexed by Google.
- The gallery order follows `PRODUCT_IMAGES` in `src/lib/content.ts`.
