# Beevo — single-product D2C store (India)

A production-ready, mobile-first e-commerce application selling one product —
the **Beevo Go mini Bluetooth thermal printer (₹1,499)** — built for the
Indian market.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **PostgreSQL + Drizzle ORM** (orders, order events, email outbox, contact messages)
- **Tailwind CSS v4** design system ("paper, ink & vermillion")
- **Zod** — every input validated on the server
- **Razorpay** (optional, REST-based, zero SDK) — enabled automatically when keys exist
- **Resend** (optional) — transactional email delivery; without it, emails are recorded in an outbox table

## Quick start

```bash
npm install
npx drizzle-kit push        # create database tables (needs DATABASE_URL)
npm run build && npm start  # production
# or
npm run dev                 # development
```

Open http://localhost:3000 — admin panel at http://localhost:3000/admin.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical site URL (SEO, emails, sitemap) |
| `ADMIN_PASSWORD` | ✅ (for /admin) | Admin login password — never committed |
| `ADMIN_SESSION_SECRET` | Recommended | HMAC key for signed admin cookies (falls back to the password) |
| `STORE_CONTACT_EMAIL` | Recommended | Support email shown across the site + policies |
| `STORE_LEGAL_NAME` | Recommended | Legal entity name used in policies |
| `STORE_ADDRESS` | Optional | Business address for legal pages |
| `EMAIL_FROM` | Optional | Sender identity for transactional emails |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional | Enables **Pay online** (UPI/cards) at checkout; COD-only without them |
| `RESEND_API_KEY` | Optional | Delivers transactional emails via Resend; without it, every email is still logged in the `email_logs` table (`delivery = skipped`) |
| `WEB3FORMS_ACCESS_KEY` | Optional | Emails contact-form messages to the store owner via Web3Forms. Messages are always stored in `contact_messages` too. The key is kept server-side; on Web3Forms' free plan (server-to-server posts blocked) the validated client completes delivery from the browser automatically |

## Payments

Two modes, both real — no mock flows:

1. **Cash on Delivery (default, always on):** order is created → confirmed → buyer pays at the door.
2. **Pay online (enabled when Razorpay keys are set):** checkout creates our order (`pending`), then a Razorpay order; the browser completes payment via Razorpay Checkout; the client result is **never trusted** — `POST /api/payments/razorpay/verify` re-verifies the HMAC signature *and* re-fetches the payment from Razorpay (status + amount) before marking the order paid. Duplicate verifications are idempotent; signature mismatches and amount mismatches mark the payment failed. Abandoned payments simply remain `pending` and can be retried or cancelled from the admin panel.

## Orders

- Human-friendly IDs: `BV-YYMMDD-####` (+ an un-guessable 48-char lookup secret per order).
- Statuses: `pending → confirmed → processing → shipped → out_for_delivery → delivered`, plus `cancelled`, `refunded`.
- Every transition is recorded in `order_events` and can email the customer (templates in `src/lib/email/templates.ts` — responsive, table-based).
- Tracking (`/track`) requires **order ID + registered mobile/email** (or the private link from the confirmation email) so strangers cannot enumerate orders.
- COD double-submits within 90 s are de-duplicated.

## Admin (`/admin`)

Password-gated via signed httpOnly cookie (12 h sessions). Dashboard shows
KPIs (orders today, to pack, revenue), filterable order list, full order
detail (customer, address, items, Razorpay refs, event history, delivered
emails) and one-click status updates with courier/tracking fields that
automatically notify the customer.

## Security notes

- All secrets live in env vars; nothing sensitive ships to the client (only `NEXT_PUBLIC_*` is bundled).
- Server-side validation for checkout, tracking, contact and admin actions (Zod).
- Same-origin checks + per-IP in-memory rate limiting on public POST APIs
  (swap `src/lib/rate-limit.ts` for Redis on multi-instance deployments).
- Parameterised queries via Drizzle; HTML escaping in emails; no PII in logs.
- Security headers via `next.config.ts`; admin/API routes excluded from `robots.txt`.

## Performance

- Server components by default; client islands only where interaction demands it.
- `next/image` (local, sized, lazy below the fold) and self-hosted variable fonts via `next/font`.
- The landing page is statically rendered; it's DB-free.

## Project layout

```
src/
  app/                routes (store, cart, checkout, order, track, legal, admin, api)
  components/         design system + client islands (cart, gallery, forms)
  lib/                config, validations, orders, payments, email, auth, http utils
  db/                 Drizzle schema + client
public/images/        AI-generated product photography (replaceable 1:1 assets)
```

## Deploy to Vercel (recommended)

The app is Vercel-ready out of the box — functions are pinned to the **Mumbai
(bom1)** region via `vercel.json`, the static landing page is served from the
edge cache, and the DB client automatically uses Neon's serverless driver
when running on Vercel.

**1. Create a database.** Add the **Neon** integration from the Vercel
Marketplace (Storage → Neon). It automatically injects `POSTGRES_URL` (and
friends) into every environment. Any other Postgres also works — just set
`DATABASE_URL`; the runtime detects Neon endpoints and picks the right driver
(`@neondatabase/serverless` over WebSockets, or a classic `pg` pool).

**2. Apply the schema.** From your machine, with the remote URL:

```bash
POSTGRES_URL="postgres://…neon.tech/…" npx drizzle-kit push
```

**3. Set environment variables** (Project → Settings → Environment Variables).
Copy `.env.example` as the checklist. Required: `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET`, `STORE_CONTACT_EMAIL`, `STORE_LEGAL_NAME`, and
`NEXT_PUBLIC_SITE_URL=https://your-domain` (set this to the production
domain — it drives canonical URLs, OpenGraph and email tracking links; after
the first deploy, update it and redeploy). Optional: `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `STORE_ADDRESS`.

**4. Deploy.** Push to Git and import the repo in Vercel, or `npx vercel`.
Build command `next build` and install `npm install` are auto-detected — no
custom CI steps needed.

**5. Post-deploy checks.** `https://your-domain/api/health` → `{"ok":true}`,
place a COD test order, sign into `/admin`, move the order through statuses,
and confirm the customer emails land (with `RESEND_API_KEY` set and your
sender domain verified).

### Serverless notes

- **Rate limiting** is in-memory per instance (fine at this scale). For a
  strict global limit across lambdas, swap `src/lib/rate-limit.ts` for
  Upstash Redis — the call sites don't change.
- **Sessions**: admin auth uses signed httpOnly cookies — no session store
  required.
- **Emails** are also recorded in the `email_logs` table, so nothing is lost
  even before a mail provider is connected.

## Deploy elsewhere (Docker / VPS / Render / Railway)

Any Node ≥ 20 host that can run `next start`:

1. Provision PostgreSQL and set the env vars from `.env.example` (`DATABASE_URL`).
2. `npx drizzle-kit push` (or generate migrations with `drizzle-kit generate` → `drizzle-kit migrate`).
3. `npm run build`, start with `npm start` (respects `$PORT` via a process manager like PM2, or containerize with a standard Next.js Dockerfile).
4. Add Razorpay keys to enable online payments; add a Resend key to send emails.

## Honesty checklist

No fake reviews, no fake MRP strikes, no countdown timers, no fake scarcity —
specs marked ≈ are the manufacturer-published approximate figures, and the
"what's in the box" list notes that contents follow the supplied package.
