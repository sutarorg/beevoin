# Beevo

A single-product e-commerce store for **Beevo Go**, an ink-free pocket thermal printer, built for the Indian market: rupees stored as integer paise, ₹999 online payment via Razorpay, ₹1,299 Cash on Delivery protected by SMS OTP verification, and a full operations admin panel.

This is a real store backend, not a demo. Orders, payments, refunds, inventory, email and the audit trail are all backed by PostgreSQL, and every privileged action is authenticated, authorised and logged.

- **Framework** — Next.js 16 (App Router, React 19, Turbopack, Node.js runtime)
- **Database** — PostgreSQL via Drizzle ORM, with real SQL migrations
- **Admin auth** — Supabase Auth (`@supabase/ssr`) for identity, plus a Beevo `admin_users` table for roles
- **Payments** — Razorpay Orders API, server-verified, with a signed webhook
- **Email** — Resend, idempotent and failure-isolated
- **Hosting** — Vercel, Mumbai region (`bom1`)

---

## Table of contents

1. [What this app does](#1-what-this-app-does)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [Prerequisites](#3-prerequisites)
4. [Quick start (local)](#4-quick-start-local)
5. [Environment variables](#5-environment-variables)
6. [Setting up Supabase Auth](#6-setting-up-supabase-auth)
7. [Setting up Razorpay](#7-setting-up-razorpay)
8. [Setting up Resend](#8-setting-up-resend)
9. [Database and migrations](#9-database-and-migrations)
10. [The admin panel](#10-the-admin-panel)
11. [Deploying to Vercel](#11-deploying-to-vercel)
12. [Testing guide](#12-testing-guide)
13. [Security model](#13-security-model)
14. [Known limitations](#14-known-limitations)
15. [Troubleshooting](#15-troubleshooting)
16. [Launch checklist](#16-launch-checklist)
17. [Project structure](#17-project-structure)

---

## 1. What this app does

**Storefront**

- Product page, cart, checkout, order success and a privacy-safe order tracker
- ₹999 online payment (UPI, cards, netbanking, wallets) via Razorpay, or ₹1,299 Cash on Delivery after SMS OTP verification
- Contact form, FAQ and the legal pages (terms, privacy and shipping)
- Price, stock, availability and the per-order quantity limit all come from the database — nothing commercial is hardcoded in the UI

**Admin panel** (`/admin`)

| Page | What it is for |
| --- | --- |
| Dashboard | Live revenue, order counts by status, and everything needing attention |
| Orders | Server-side search, filter and pagination over every order |
| Order detail | Item snapshot, payments, refunds, timeline, emails, status changes, tracking |
| Payments | Every reconciled Razorpay payment |
| Refunds | Refund history with reason and requester |
| Customers | Derived from real orders, with per-customer order history |
| Product | Edit the authoritative product row; price sits behind its own permission |
| Inventory | Delta-based stock adjustments plus the full stock ledger |
| Messages | Contact-form submissions and their status |
| Emails | Every transactional email attempt, with retry for failures |
| Webhooks | Razorpay deliveries, signature and processing state |
| Settings | Non-secret store settings; integrations shown as configured / missing |
| Admin users | Grant, change and suspend admin access |
| Audit log | Append-only record of every privileged action |

---

## 2. Architecture at a glance

```
Browser
  │
  ├─ Storefront (Server Components)  ── cached product read (60s, tag: "product")
  │
  ├─ /api/checkout ──────────────────── authoritative product read → order → Razorpay order
  │
  ├─ /api/payments/razorpay/verify ──┐
  │                                  ├─→ reconcileRazorpayPayment()  ← single source of truth
  └─ /api/webhooks/razorpay ─────────┘        re-fetches the payment from Razorpay,
       (raw-body HMAC, idempotent)            checks linkage + amount + currency + capture

Admin (/admin)
  │
  ├─ src/proxy.ts ──── refreshes the Supabase session cookie, bounces anonymous visitors
  └─ requireAdmin()/authorize() ── re-verifies session + admin_users row + role on EVERY
                                    page render and EVERY server action
```

Two rules shape the whole codebase:

1. **Supabase is identity only.** Application data never leaves PostgreSQL/Drizzle. There is no `supabase.from(...)` anywhere.
2. **The database is authoritative.** Online price, COD price, shipping, stock, active state and max-per-order are read from the `products` row at checkout time, every time. The storefront's cached copy is for rendering only.

For the detailed design — status machine, concurrency strategy, idempotency keys — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 3. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer (22 recommended) | `node --version` |
| npm | 10 or newer | ships with Node |
| PostgreSQL | 14 or newer | local install, Docker, or a hosted database |
| Git | any recent | |

Accounts you will need (all have free tiers):

- [Supabase](https://supabase.com) — admin sign-in
- [Razorpay](https://razorpay.com) — online payments (Indian business KYC required for live mode)
- [Resend](https://resend.com) — transactional email
- [Vercel](https://vercel.com) — hosting
- [GitHub](https://github.com) — source control

---

## 4. Quick start (local)

```bash
# 1. Clone and install
git clone https://github.com/sutarorg/beevoin.git
cd beevoin
npm install

# 2. Configure the environment
cp .env.example .env.local
#    Open .env.local and set DATABASE_URL at minimum.

# 3. Create the schema and the baseline rows
npm run db:migrate
npm run db:seed

# 4. (Optional) Sample orders so the admin isn't empty
npm run seed:dev

# 5. Run it
npm run dev
```

Open <http://localhost:3000>.

`npm run db:seed` creates the product with **0 units in stock**, because inventing stock would be lying to you. Either run `npm run seed:dev` (which stocks 50 units locally) or add real stock from **/admin → Inventory**.

You can browse the storefront with nothing but `DATABASE_URL` set. Online payment needs Razorpay, email needs Resend, and `/admin` needs Supabase — each degrades cleanly and tells you what is missing rather than crashing.

### All scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a new migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations from `drizzle/` |
| `npm run db:seed` | Create the product row and default settings (safe, idempotent) |
| `npm run seed:dev` | **Local only.** Sample orders, customers and stock |

---

## 5. Environment variables

Copy `.env.example` to `.env.local`. Every variable below is read by code in this repository.

| Variable | Required | Where it is used | How to get it |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | All application data | Your PostgreSQL provider. Use the **pooled** connection string in production |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical URLs, sitemap, Open Graph, email links | Your public origin, no trailing slash |
| `STORE_CONTACT_EMAIL` | Yes | Support address on legal pages, fallback notification target | Your support inbox |
| `STORE_LEGAL_NAME` | Yes | Legal pages, invoices | Your registered business name |
| `STORE_ADDRESS` | Yes | Legal pages | Your business address |
| `NEXT_PUBLIC_SUPABASE_URL` | For `/admin` | Supabase Auth | Supabase → Connect, or Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For `/admin` | Supabase Auth | Same screen. Starts `sb_publishable_` |
| `RAZORPAY_KEY_ID` | For online payments | Creating orders, Checkout | Razorpay → Account & Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | For online payments | Signature verification, capture, refunds | Shown once when you generate the key |
| `RAZORPAY_WEBHOOK_SECRET` | Strongly recommended | Verifying webhook signatures | You choose it when creating the webhook |
| `TWILIO_ACCOUNT_SID` | For COD | Twilio Verify API authentication | Twilio Console → Account dashboard |
| `TWILIO_AUTH_TOKEN` | For COD | Twilio Verify API authentication | Twilio Console → Account dashboard |
| `TWILIO_VERIFY_SERVICE_SID` | For COD | Sending and checking COD SMS OTPs | Twilio Console → Verify → Services |
| `COD_OTP_TOKEN_SECRET` | For COD | Signing the one-time post-verification checkout token | Generate: `openssl rand -base64 48` |
| `RESEND_API_KEY` | For email | All transactional email | Resend → API Keys |
| `RESEND_FROM_EMAIL` | For email | Sender address | Must be on a domain verified in Resend |
| `RESEND_FROM_NAME` | For email | Sender display name | e.g. `Beevo` |
| `ADMIN_NOTIFICATION_EMAIL` | Recommended | Contact-form, low-stock and payment-failure alerts | Your ops inbox. Editable later from /admin/settings |

**There is no `SUPABASE_SECRET_KEY`, no `ADMIN_PASSWORD`, no `ADMIN_SESSION_SECRET` and no `WEB3FORMS_ACCESS_KEY`.** If you are upgrading from an older deployment, delete those four variables — nothing reads them any more.

Only `NEXT_PUBLIC_*` variables reach the browser. Never prefix a secret with `NEXT_PUBLIC_`.

---

## 6. Setting up Supabase Auth

Supabase provides **identity only**. Orders, customers and payments never touch it.

### 6.1 Create the project

1. Go to <https://supabase.com/dashboard> and sign in.
2. Click **New project**.
3. Name it (e.g. `beevo-auth`), set a strong database password, and pick the region closest to your customers (**South Asia (Mumbai)** for India).
4. Click **Create new project** and wait for provisioning to finish.

### 6.2 Copy the two keys

1. In the project, click **Connect** in the top bar (or go to **Project Settings → API Keys**).
2. Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **publishable key** (starts `sb_publishable_`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

> If your project still shows legacy `anon` / `service_role` keys, the `anon` key works in the publishable slot, but migrate when you can — legacy keys are being retired.

### 6.3 Turn off public signups

You do not want strangers creating accounts on your auth project.

1. Go to **Authentication → Sign In / Providers**.
2. Under **Email**, disable **Allow new users to sign up**.
3. Keep **Confirm email** enabled.

Even if a signup did happen, it would grant nothing: being a Supabase user is not being a Beevo admin.

### 6.4 Create your first admin person

1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a strong password. Tick **Auto Confirm User**.
3. Click **Create user**.
4. Click the new user and copy their **UID** (a UUID).

### 6.5 Link them as the store owner

The first admin has to be inserted directly, because there is no admin yet to do it from the UI. Run this against your database, substituting the UID, email and name:

```sql
insert into admin_users (supabase_user_id, email, name, role, status)
values (
  '00000000-0000-0000-0000-000000000000',  -- the UID you copied
  'you@yourstore.in',
  'Your Name',
  'owner',
  'active'
);
```

Now go to `/admin/login`, sign in with that email and password, and you are in. Every further admin is added from **/admin → Admin users** — no SQL required.

### 6.6 Set the redirect URLs (production)

1. **Authentication → URL Configuration**.
2. Set **Site URL** to your production origin (e.g. `https://yourstore.in`).
3. Add your Vercel preview domain to **Redirect URLs** if you want previews to work.

---

## 7. Setting up Razorpay

### 7.1 API keys

1. Sign in at <https://dashboard.razorpay.com>.
2. Use the **Test Mode** toggle while developing.
3. Go to **Account & Settings → API Keys → Generate Test Key**.
4. Copy the **Key ID** → `RAZORPAY_KEY_ID`, and the **Key Secret** → `RAZORPAY_KEY_SECRET`.

The secret is shown only once. If you lose it, regenerate.

### 7.2 Webhook

The webhook is what makes payments reliable: if a customer's browser dies after paying, the webhook still confirms the order.

1. Go to **Account & Settings → Webhooks → Add New Webhook**.
2. **Webhook URL**: `https://yourstore.in/api/webhooks/razorpay`
3. **Secret**: invent a long random string. Put the same string in `RAZORPAY_WEBHOOK_SECRET`.
   ```bash
   openssl rand -hex 32
   ```
4. **Active Events** — tick exactly these:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `refund.created`
   - `refund.processed`
   - `refund.failed`
5. Click **Create Webhook**.

Test and Live modes have **separate** webhooks. Create it twice, once in each mode, and use a different secret for each.

Any event you did not subscribe to is acknowledged with a 200 and logged, and never changes an order.

### 7.3 Going live

1. Complete KYC in the Razorpay dashboard.
2. Switch to **Live Mode**, generate live API keys, and create the live webhook.
3. Update `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in Vercel, then redeploy.

### 7.4 Set up COD SMS OTP verification (Twilio Verify)

COD is intentionally unavailable until this is configured. Beevo sends the OTP to the customer, asks Twilio Verify to check it, and consumes a short-lived one-time token in the same database transaction that creates the COD order. The app never stores the OTP itself.

1. Sign in at <https://console.twilio.com> and complete the account's required verification/KYC steps for sending SMS to India.
2. In the left navigation, open **Verify → Services**, then choose **Create new Service**.
3. Name it (for example, `Beevo COD verification`) and create it. Copy the resulting **Service SID** (starts with `VA`) into `TWILIO_VERIFY_SERVICE_SID`.
4. Open **Account Dashboard**. Copy the **Account SID** into `TWILIO_ACCOUNT_SID` and reveal/copy the **Auth Token** into `TWILIO_AUTH_TOKEN`.
5. Configure the India sender/template and any DLT registration Twilio requests for your account. Use Twilio's approved Verify SMS template; do not put an OTP in this repository or browser code.
6. Generate a token-signing secret locally and save it only as an environment variable:
   ```bash
   openssl rand -base64 48
   ```
   Put the output in `COD_OTP_TOKEN_SECRET`.
7. Add all four values to the production host, redeploy, then open **/admin → Settings**. **Twilio Verify (COD mobile OTP)** must show **Configured**.
8. Place a real test COD checkout: enter a valid Indian mobile number, choose **Cash on Delivery**, click **Send OTP**, enter the SMS code, click **Verify**, and then place the order. Reusing the same verified browser token must fail by design.

---

## 8. Setting up Resend

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain** and enter the domain your email will come from.
3. Add the DNS records Resend shows you (SPF, DKIM, and the return-path record) at your DNS provider. The exact values are unique to your domain — copy them from the Resend screen.
4. Wait for the domain to show **Verified**.
5. **API Keys → Create API Key**, with **Sending access**. Copy it → `RESEND_API_KEY`.
6. Set `RESEND_FROM_EMAIL` to an address on that verified domain (e.g. `orders@yourstore.in`) and `RESEND_FROM_NAME` to your store name.

Without `RESEND_API_KEY` the app still works: emails are logged as `skipped` in **/admin → Emails**, and no order is ever blocked by an email failure.

Emails sent:

| Trigger | To | Template |
| --- | --- | --- |
| COD order placed | Customer | Order confirmed |
| Online payment verified | Customer | Payment received |
| Payment failed | Customer | Payment failed |
| Status → processing / shipped / out for delivery / delivered / cancelled | Customer | Matching status update |
| Refund processed | Customer | Refund issued |
| Contact form submitted | `ADMIN_NOTIFICATION_EMAIL` | Contact notification |
| Stock at or below threshold | `ADMIN_NOTIFICATION_EMAIL` | Low inventory alert |
| Online payment failed | `ADMIN_NOTIFICATION_EMAIL` | Payment failure alert |

Each send has a deterministic idempotency key stored in `email_logs.event_key`, so retries and webhook races can never email the same customer twice for the same event.

---

## 9. Database and migrations

### Provisioning

Any PostgreSQL 14+ database works. Common choices:

- **Vercel Postgres / Neon** — `Storage → Create → Postgres`, then copy the pooled connection string
- **Supabase Postgres** — `Connect → Connection string → Transaction pooler`
- **Local** — `createdb beevo`, then `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/beevo`

Always use the **pooled** string in serverless environments.

### Applying migrations

```bash
npm run db:migrate
```

Migrations live in `drizzle/` as plain SQL and are applied in order by `scripts/db-migrate.ts`. They are checked in, reviewable and re-runnable — `drizzle-kit push` is not used against production.

- `0000_baseline.sql` recreates the original four tables with `IF NOT EXISTS`, so it is a no-op on an existing database.
- `0001_production_upgrade.sql` adds the new tables and columns. It only adds; it never drops or rewrites customer data.

Upgrading a live database from an older Beevo:

```bash
# 1. Back up first, always.
pg_dump "$DATABASE_URL" > beevo-backup-$(date +%F).sql

# 2. Apply the migrations.
npm run db:migrate

# 3. Create the product row and settings (existing rows are left untouched).
npm run db:seed

# 4. Set your real stock level from /admin → Inventory.
```

Existing orders keep their historical totals. Nothing backfills or rewrites them.

### Changing the schema

```bash
# edit src/db/schema.ts, then:
npm run db:generate   # writes a new SQL file into drizzle/
npm run db:migrate    # applies it
```

Review the generated SQL before committing it.

### Tables

`products`, `customers`, `orders`, `order_items`, `order_events`, `payments`, `refunds`, `inventory_events`, `webhook_events`, `email_logs`, `contact_messages`, `admin_users`, `admin_audit_logs`, `store_settings`.

---

## 10. The admin panel

### Roles

| Role | Can do |
| --- | --- |
| **owner** | Everything, including settings and managing admins |
| **admin** | Everything except editing store settings and managing admins |
| **support** | Dashboard, view orders, customers, messages, emails |
| **fulfillment** | Dashboard, view orders, change status, set tracking, manage inventory |

Permissions are enforced in three places: the navigation hides what you cannot use, each page calls `requirePermission(...)`, and **every server action calls `authorize(...)` again before writing anything**. Hiding a button is never the security control.

### Order status machine

```
pending ──────────→ payment_pending, confirmed, cancelled
payment_pending ──→ confirmed, cancelled, pending
confirmed ────────→ processing, cancelled
processing ───────→ shipped, cancelled
shipped ──────────→ out_for_delivery, delivered, cancelled
out_for_delivery ─→ delivered, shipped
delivered ────────→ refunded
cancelled ────────→ refunded
refunded ─────────→ (terminal)
```

Illegal transitions are rejected server-side with a clear message. `refunded` can only be reached through the refund workflow, never by picking it from a dropdown.

Payment status is tracked separately from order status, so "delivered but not yet paid" (a normal COD state) is representable.

### Inventory

Stock is only ever changed by a **delta** inside a conditional `UPDATE ... WHERE inventory_quantity >= n`, in the same transaction that creates or cancels the order. Two simultaneous checkouts for the last unit cannot both succeed. Every movement is written to `inventory_events` with a reason and an actor.

- COD orders reserve stock immediately at checkout.
- Online orders reserve stock only when payment is verified, so abandoned checkouts never hold inventory.
- Cancelling or refunding-with-restock returns the units, exactly once (guarded by `inventory_released_at`).

### Refunds

Full or partial, issued through the Razorpay refund API from an order's detail page. The flow is: authorise → validate the amount against the captured payment → atomically reserve the refund balance → call Razorpay → record the refund, update the payment and order, optionally restock → audit → email the customer. If Razorpay fails, the reservation is rolled back and the refund row is marked `failed`.

### Price changes

Price and shipping sit behind the `product.update_price` permission (owner and admin only) and are always audit-logged with the before and after values. **Changing the price affects new orders only** — every order stores its own product name, SKU, unit price and total at checkout time, so order history is never rewritten.

---

## 11. Deploying to Vercel

### 11.1 Push to GitHub

```bash
git remote -v                       # confirm your remote
git add -A
git commit -m "Production-ready Beevo backend and admin"
git push origin main
```

### 11.2 Import into Vercel

1. Go to <https://vercel.com/new>.
2. **Import Git Repository** and pick your repo. Authorise GitHub if asked.
3. Framework preset: **Next.js** (auto-detected). Leave build and output settings alone.
4. Expand **Environment Variables** and add every variable from [section 5](#5-environment-variables) for the **Production** environment.
5. Click **Deploy**.

The region is already pinned to Mumbai (`bom1`) in `vercel.json`, which keeps latency low for Indian customers and close to an Indian database.

### 11.3 After the first deploy

1. **Run the migrations** against your production database. From your machine, with production `DATABASE_URL` exported:
   ```bash
   DATABASE_URL="postgres://…prod…" npm run db:migrate
   DATABASE_URL="postgres://…prod…" npm run db:seed
   ```
2. **Link your first admin** with the SQL in [section 6.5](#65-link-them-as-the-store-owner).
3. **Set `NEXT_PUBLIC_SITE_URL`** to the real production origin and redeploy (it is baked into the client bundle at build time).
4. **Create the Razorpay live webhook** pointing at `https://yourstore.in/api/webhooks/razorpay`.
5. **Add stock** from /admin → Inventory.

### 11.4 Custom domain

1. Vercel project → **Settings → Domains → Add**.
2. Enter your domain and follow the DNS instructions Vercel shows for your specific registrar.
3. Wait for the certificate to be issued, then update `NEXT_PUBLIC_SITE_URL` and redeploy.
4. Update the Supabase **Site URL** and the Razorpay webhook URL to match.

---

## 12. Testing guide

### 12.1 Cash on Delivery

1. Add stock at /admin → Inventory.
2. On the storefront, add to cart → Checkout → fill the address → choose **Cash on Delivery** → **Send OTP** → enter the SMS code → **Verify** → Place order.
3. Expected: redirect to the success page with an order number; the order appears in /admin → Orders as `confirmed`; stock drops by the quantity; an `order_confirmed` email is logged.

### 12.2 Online payment (Razorpay test mode)

Use test credentials from Razorpay's docs — for example card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`; or UPI id `success@razorpay`.

1. Choose **Pay online** at checkout.
2. Complete the test payment.
3. Expected: the order becomes `confirmed` with payment status `paid`; a row appears in /admin → Payments marked verified and captured; stock drops; a `payment_received` email is logged.

Then try `failure@razorpay` as the UPI id: the order should stay unpaid, stock should **not** drop, and a payment-failure alert should be logged.

### 12.3 Webhook

Locally, expose your dev server (`ngrok http 3000` or similar) and point a Test-mode webhook at `https://<tunnel>/api/webhooks/razorpay`.

- Pay once and confirm /admin → Webhooks shows `payment.captured` as verified and processed.
- Use **Resend** on the delivery in the Razorpay dashboard: the second delivery must be recorded as a duplicate and must not change the order again.
- Change `RAZORPAY_WEBHOOK_SECRET` to a wrong value and resend: the endpoint must return 400 and nothing may be written.

Quick signature test from the shell:

```bash
BODY='{"event":"payment.captured","payload":{}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" | sed 's/^.* //')
curl -i -X POST http://localhost:3000/api/webhooks/razorpay \
  -H 'Content-Type: application/json' \
  -H "X-Razorpay-Signature: $SIG" \
  -H 'X-Razorpay-Event-Id: manual-test-1' \
  -d "$BODY"
```

Run it twice: the first call should return `{"ok":true}`, the second `{"duplicate":true}`.

### 12.4 Refunds

1. Open a paid order in /admin → Orders.
2. In the **Refund** panel, refund a partial amount with a reason.
3. Expected: the refund appears in /admin → Refunds; the order shows the refunded amount; payment status becomes `partially_refunded`; the customer gets a refund email; the audit log records who did it.
4. Refund the remainder and confirm the order moves to `refunded`.

### 12.5 Oversell protection

Set stock to 1, then place two orders for that unit at the same time (two browser windows, or two `curl` calls fired together). Exactly one must succeed; the other must get "out of stock" and no negative stock may ever appear.

### 12.6 Order tracking privacy

1. Visit `/track` and enter an order number with the **wrong** phone number → generic "not found".
2. Enter the correct phone → the order appears with a masked name, no street address, no email and no phone.

### 12.7 Admin authorisation

1. Create a second Supabase user, link them as `support` from /admin → Admin users.
2. Sign in as them: Settings, Admin users, Product editing and Refunds must be absent from the navigation, and visiting those URLs directly must land on `/admin/denied`.
3. Suspend that user from an owner account; their very next request must be refused.

### 12.8 Before every deploy

```bash
npm run lint
npm run typecheck
npm run build
```

---

## 13. Security model

- **Payments are never trusted from the browser.** The client's "payment succeeded" callback is only a hint. The server re-fetches the payment from Razorpay and independently checks that it belongs to this order, matches the expected amount to the paise, is in INR, and is actually captured, before anything is marked paid.
- **Signature verification uses constant-time comparison** (`crypto.timingSafeEqual`) for both the checkout callback and the webhook.
- **The webhook reads the raw request body** and verifies the HMAC **before** parsing any JSON. A forged body cannot reach the parser.
- **Idempotency everywhere**: unique `(provider, event_id)` on webhook deliveries, unique provider payment and refund IDs, unique email `event_key`, and one-shot inventory reservation/release timestamps.
- **Money is integer paise.** No floats touch a price. ₹999 online is `99900`; ₹1,299 COD is `129900`.
- **Admin authorisation is re-checked on every request** — the proxy only refreshes cookies; it never authorises. A suspended admin loses access on their next request, with no session to wait out.
- **CSRF**: same-origin checks on browser-facing POST endpoints. The webhook is deliberately exempt (it is server-to-server and authenticated by HMAC instead).
- **Order lookup requires two factors** — the order number plus the registered phone, registered email, or the un-guessable lookup secret — and returns a masked, address-free summary.
- **Logs and audit metadata are sanitised**: passwords, tokens, API keys, cookies and customer addresses are stripped before anything is written.
- **Security headers**: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `no-store` on the whole admin panel.

---

## 14. Known limitations

Stated plainly, because knowing them is part of running the store.

- **Rate limiting is in-memory and per instance.** On Vercel each serverless instance keeps its own counters, so the effective global limit is roughly `limit × warm instances`. It stops accidental hammering and naive scripts; it is **not** a distributed limiter. `src/lib/rate-limit.ts` exposes a `RateLimitStore` interface — implement it against Redis/Upstash and call `setRateLimitStore()` once at startup to make the limits global, with no changes to any call site.
- **Single-product store.** The schema supports multiple products (`products`, `order_items`), but the storefront and checkout are built for exactly one. Adding a catalogue means UI work.
- **No customer accounts.** Customers are derived from orders. There is no login, no saved addresses, no order history page beyond the tracking lookup.
- **Email sends are synchronous and best-effort.** There is no background queue: a failed send is logged and can be retried from /admin → Emails, but nothing retries it automatically.
- **The Content-Security-Policy allows `'unsafe-inline'` scripts.** Next.js injects inline bootstrap payloads and Razorpay Checkout injects inline handlers. Tightening this needs per-request nonces threaded through `proxy.ts`.
- **Webhook processing is synchronous.** Razorpay's delivery is held open while the order is reconciled. This is fine at this volume; at high volume you would enqueue instead.
- **No automated test suite.** Verification is the manual guide in [section 12](#12-testing-guide) plus `lint`, `typecheck` and `build`.
- **Shipping is a single flat amount.** No pincode-based rates, no weight tiers, no courier integration beyond recording a courier name and tracking ID.

---

## 15. Troubleshooting

**`No database URL configured` when running a script**
`DATABASE_URL` is not set in the shell. Scripts read `.env` / `.env.local` via dotenv; confirm the file exists, or export the variable inline: `DATABASE_URL=... npm run db:migrate`.

**Storefront says the product is unavailable**
The `products` table is empty or the product is inactive or out of stock. Run `npm run db:seed`, then add stock at /admin → Inventory and make sure "Sell this product on the storefront" is ticked.

**`/admin/login` says Supabase Auth is not configured**
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing. These are baked into the client bundle at build time, so after setting them in Vercel you must **redeploy**, not just restart.

**"This account does not have admin access"**
Supabase authenticated you, but there is no active `admin_users` row for that user. Check that `supabase_user_id` exactly matches the UID in Supabase → Authentication → Users, and that `status` is `active`.

**Signed in, then immediately bounced back to the login page**
Usually a cookie problem: mismatched `NEXT_PUBLIC_SITE_URL`, or a Supabase **Site URL** that does not match the origin you are browsing. Make both exactly your production origin.

**Online payment option does not appear at checkout**
`RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` is missing. Check /admin → Settings → Integrations, or `GET /api/health`.

**Payment succeeded for the customer but the order is not confirmed**
Open /admin → Webhooks. If there is no delivery, the webhook is not configured or the URL is wrong. If the delivery shows `Rejected`, `RAZORPAY_WEBHOOK_SECRET` does not match the secret in the Razorpay dashboard — and remember Test and Live have separate webhooks and separate secrets.

**Webhook returns 503**
`RAZORPAY_WEBHOOK_SECRET` is unset. The endpoint refuses to accept unverifiable deliveries rather than trusting them.

**Emails are logged as `skipped`**
`RESEND_API_KEY` is not set.

**Emails are logged as `failed`**
Read the error in /admin → Emails. Almost always the sending domain is not verified in Resend, or `RESEND_FROM_EMAIL` is on a different domain than the verified one.

**`npm run build` fails fetching Google Fonts**
The build machine has no outbound network access to `fonts.googleapis.com`. `next/font` downloads and self-hosts the fonts at build time, so the build host needs internet.

**Migration fails with "relation already exists"**
The database already has the tables but no `__drizzle_migrations` bookkeeping. Restore a backup into a clean database and migrate that, or mark the baseline as applied manually. Never hand-edit a partially applied migration.

---

## 16. Launch checklist

**Infrastructure**

- [ ] Production PostgreSQL provisioned, pooled connection string in Vercel
- [ ] `npm run db:migrate` run against production
- [ ] `npm run db:seed` run against production
- [ ] Database backups enabled at your provider

**Configuration**

- [ ] Every variable in [section 5](#5-environment-variables) set in Vercel Production
- [ ] `NEXT_PUBLIC_SITE_URL` is the real origin, no trailing slash
- [ ] `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `WEB3FORMS_ACCESS_KEY` deleted from every environment
- [ ] `GET /api/health` returns `ok: true` with all four integrations `true`

**Auth**

- [ ] Supabase public signups disabled
- [ ] Supabase Site URL matches production
- [ ] At least one `owner` in `admin_users`, and at least two people can sign in
- [ ] A non-owner role tested and correctly restricted

**Payments**

- [ ] Razorpay KYC complete, live keys in Vercel
- [ ] Live webhook created with all seven events and the matching secret
- [ ] One real low-value live payment placed and verified end to end
- [ ] That payment refunded successfully from the admin

**Commerce**

- [ ] Real price and shipping set on the product
- [ ] Real stock entered, and the low-stock threshold set sensibly
- [ ] Max per order set
- [ ] Product copy, specifications and images reviewed on the live site

**Email**

- [ ] Resend domain verified (SPF + DKIM green)
- [ ] Order confirmation, shipped and refund emails all received at a real inbox
- [ ] Contact form delivers to `ADMIN_NOTIFICATION_EMAIL`

**Store content**

- [ ] Legal name and address correct on terms, privacy, shipping and returns
- [ ] Support email and hours correct in /admin → Settings

**Final**

- [ ] `npm run lint`, `npm run typecheck`, `npm run build` all pass
- [ ] Storefront checked on a real phone
- [ ] Order tracking verified with both a correct and an incorrect verification factor
- [ ] Someone other than you has signed in to the admin and placed a test order

---

## 17. Project structure

```
beevoin/
├── drizzle/                     SQL migrations (checked in, applied in order)
├── docs/ARCHITECTURE.md         Design decisions, concurrency and idempotency
├── scripts/
│   ├── db-migrate.ts            Applies pending migrations
│   ├── db-seed.ts               Product row + default settings (safe, idempotent)
│   └── seed-dev.ts              Local-only sample data
└── src/
    ├── proxy.ts                 Next 16 proxy: Supabase session refresh for /admin
    ├── app/
    │   ├── (storefront pages)   /, /cart, /checkout, /track, /order/success, legal
    │   ├── admin/
    │   │   ├── actions.ts       EVERY admin mutation, each re-authorised
    │   │   ├── login/           Supabase sign-in page and server actions
    │   │   ├── denied/          Access-denied explanations
    │   │   └── (panel)/         Dashboard, orders, payments, refunds, customers,
    │   │                        product, inventory, messages, emails, webhooks,
    │   │                        settings, admins, audit
    │   └── api/
    │       ├── checkout/        Order creation, authoritative pricing
    │       ├── payments/razorpay/verify/   Browser callback → reconciliation
    │       ├── webhooks/razorpay/          Raw-body HMAC, idempotent
    │       ├── contact/ track/ health/
    ├── components/              Storefront UI + components/admin/* panel kit
    ├── db/                      Drizzle schema and client
    └── lib/
        ├── auth/                Permission matrix and admin resolution
        ├── supabase/            client / server / proxy helpers (@supabase/ssr)
        ├── services/            products, inventory, customers, payments,
        │                        refunds, webhooks, audit, settings
        ├── payments/razorpay.ts Razorpay REST client + signature verification
        ├── email/               Templates and idempotent sending
        ├── admin/queries.ts     Paginated, searchable admin list queries
        ├── orders.ts            Order creation and the status machine
        └── validations.ts       Every Zod schema
```

---

## Licence

Private and proprietary. All rights reserved.
