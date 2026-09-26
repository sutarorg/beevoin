# Beevo — single-product store (India)

A production e-commerce application that sells one product: the **Beevo Go
Mini Thermal Printer** (SKU `BG-GO-01`, ₹1,499, free shipping, max 5 per
order). Cash on Delivery and Razorpay online payments, a full staff admin
panel, transactional email, and an auditable order/payment/refund trail.

Everything money touches is computed and verified on the server. The browser
can never set a price, a total, an order status, or a payment outcome.

---

## Contents

1. [Stack](#1-stack)
2. [How it works](#2-how-it-works)
3. [Run it locally](#3-run-it-locally)
4. [Supabase Auth setup (admin sign-in)](#4-supabase-auth-setup-admin-sign-in)
5. [Razorpay setup (test, then live)](#5-razorpay-setup-test-then-live)
6. [Resend setup (transactional email)](#6-resend-setup-transactional-email)
7. [Environment variables](#7-environment-variables)
8. [Database & migrations](#8-database--migrations)
9. [The admin panel](#9-the-admin-panel)
10. [Deploy: GitHub → Vercel](#10-deploy-github--vercel)
11. [Testing](#11-testing)
12. [Security notes and known limits](#12-security-notes-and-known-limits)
13. [Troubleshooting](#13-troubleshooting)
14. [Launch checklist](#14-launch-checklist)

---

## 1. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, React 19, TypeScript) | Server Components + server actions |
| Data | **PostgreSQL + Drizzle ORM** | The single source of truth for all store data |
| Admin identity | **Supabase Auth** (`@supabase/ssr`) | Staff sign-in only — no store data is kept in Supabase |
| Payments | **Razorpay** REST API (no SDK) | Optional: without keys the store is COD-only |
| Email | **Resend** | Optional: without a key every email is still logged with `delivery = "skipped"` |
| Styling | **Tailwind CSS v4** | "paper, ink & vermillion" design system |
| Validation | **Zod** | Every request body and every admin form |
| Tests | **Vitest** against a real PostgreSQL database | See [Testing](#11-testing) |

Money is always an **integer number of paise** (`149900` = ₹1,499.00). There
are no floats anywhere in the payment path.

## 2. How it works

**Cash on Delivery**

```
customer submits checkout
  → server re-reads the product row and computes the total
  → order created (status: pending)  + order_items + customer record
  → stock committed atomically       (status: confirmed)
  → confirmation email + owner notification (best effort)
```

**Online payment (Razorpay)**

```
customer submits checkout
  → order created (status: pending) and a Razorpay order created server-side
  → status: payment_pending, payment attempt recorded
  → Razorpay Checkout opens in the browser
  → browser callback  ─┐
                       ├─→ reconcileRazorpayPayment()  (idempotent)
  → webhook delivery  ─┘        • re-fetches the payment from Razorpay
                                • checks order linkage, amount, currency
                                • captures it if it is only authorized
                                • commits stock, confirms the order once
                                • sends email once
```

The browser callback and the webhook are treated as two unordered, untrusted
hints that *something happened*. Neither is believed: the payment is always
re-fetched from Razorpay server-side, and the reconciler is safe to run any
number of times, in any order, concurrently.

**Order status machine** (enforced server-side, every change writes an event):

```
pending ──▶ payment_pending ──▶ confirmed ──▶ processing ──▶ shipped
                                                   ──▶ out_for_delivery ──▶ delivered
any open state ──▶ cancelled            paid states ──▶ refunded (terminal)
```

Stock is committed when an order becomes `confirmed` and returned when it is
`cancelled` or refunded-with-restock — each exactly once, guarded by
`orders.inventory_committed_at` / `inventory_released_at`.

## 3. Run it locally

**Prerequisites:** Node.js 20+, npm, and a PostgreSQL 14+ database you can
connect to.

```bash
# 1. clone and install
git clone https://github.com/sutarorg/beevoin.git
cd beevoin
npm install

# 2. configure
cp .env.example .env.local
#    edit .env.local — at minimum DATABASE_URL and NEXT_PUBLIC_SITE_URL

# 3. create the schema (safe to re-run; never drops anything)
npm run db:migrate

# 4. insert the single product row + default store settings
#    INITIAL_STOCK is optional and only applies to a brand-new product row
INITIAL_STOCK=25 npm run db:seed

# 5. run
npm run dev          # http://localhost:3000
```

The storefront works immediately with Cash on Delivery. To sign in to
`/admin` you need Supabase (step 4 below); to take online payments you need
Razorpay (step 5); to actually deliver email you need Resend (step 6).

Check that everything is wired up:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"checks":{"app":true,"database":true,"razorpay":false,
#  "razorpayWebhook":false,"resend":false,"supabaseAuth":true}}
```

`ok` only depends on the app and the database — the other flags tell you
which optional integrations are configured. No secret values are exposed.

## 4. Supabase Auth setup (admin sign-in)

Supabase is used **only** to authenticate staff. Orders, payments, refunds and
every other record stay in your own PostgreSQL database.

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a name, a
   strong database password (you will not need it here) and the region
   closest to you (e.g. *South Asia (Mumbai)*). Wait for it to finish.
2. Open **Project Settings → API keys**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (the `sb_publishable_…` one, safe for the browser)
     → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Paste both into `.env.local`. You do **not** need a secret/service-role
   key — this app never uses one.
3. Open **Authentication → Sign In / Providers**:
   - keep **Email** enabled (the admin form signs in with email + password),
   - turn **Allow new users to sign up** **off** — nobody should be able to
     create a staff account from the internet,
   - optionally turn **Confirm email** off, since you create staff accounts
     by hand.
4. Create your own login: **Authentication → Users → Add user → Create new
   user**. Enter your email and a strong password, and tick *Auto Confirm
   User*. Then click the new user and copy its **User UID** (a UUID).
5. Grant that Supabase user access to the admin panel. Being a Supabase user
   is not enough — a matching row in the `admin_users` table is what actually
   authorises a person:

   ```bash
   npm run admin:bootstrap -- \
     --email you@yourdomain.com \
     --supabase-id 00000000-0000-0000-0000-000000000000 \
     --name "Your Name"
   ```

   The default role is `owner`. The command is idempotent — running it again
   updates and re-activates the same person. No credentials are ever stored
   in this repository or in the database; Supabase holds the password.
6. Start the app, open <http://localhost:3000/admin>, and sign in. Every
   other staff member is created from **Admin → Admin users** afterwards
   (create the Supabase user first, then add their UID there).

**Roles**

| Role | What they can do |
| --- | --- |
| `owner` | Everything, including store settings and managing admin users |
| `admin` | Everything except store settings and admin-user management |
| `support` | Read-only across orders, payments, refunds and customers; can resolve messages and retry emails |
| `fulfillment` | Order status + courier/tracking updates and inventory only |

Permissions are enforced on the server on every page load and every action
(`src/lib/auth/permissions.ts`); the UI only hides what would be refused
anyway. A signed-in Supabase user with no active `admin_users` row is signed
out and sent to `/admin/no-access`.

## 5. Razorpay setup (test, then live)

Without Razorpay keys the checkout page simply offers Cash on Delivery only —
nothing breaks.

### 5.1 Test mode

1. Sign up at <https://dashboard.razorpay.com>. Leave the mode switch on
   **Test Mode**.
2. **Account & Settings → API Keys → Generate Test Key**. Copy:
   - Key ID (`rzp_test_…`) → `RAZORPAY_KEY_ID`
   - Key Secret → `RAZORPAY_KEY_SECRET` (shown once — store it safely)
3. Restart `npm run dev`. "Pay online" now appears at checkout.
4. Place a test order and pay with a Razorpay test instrument (e.g. the test
   card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `754081` on
   the test OTP screen). The order should land on the success page as
   **Confirmed / Paid**, and `/admin/orders` should show the payment.

### 5.2 Webhook

The webhook is what makes payments reliable when a customer closes the tab
mid-payment.

1. **Account & Settings → Webhooks → Add New Webhook**.
2. **Webhook URL**: `https://<your-domain>/api/webhooks/razorpay`.
   Razorpay rejects `localhost`, `*.local`, `webhook.site` and similar
   tunnel/testing hosts — use your deployed Vercel URL (a preview deployment
   is fine) rather than your laptop.
3. **Secret**: invent a long random string. Put the same value in
   `RAZORPAY_WEBHOOK_SECRET`. Without it the endpoint rejects everything.
4. **Active events**: `payment.authorized`, `payment.captured`,
   `payment.failed`, `order.paid`, `refund.created`, `refund.processed`,
   `refund.failed`. Anything else is recorded and ignored.
5. Save, then trigger a test payment and watch **Admin → Webhooks**: each
   delivery is stored with its event id, signature-verification result and
   outcome. Razorpay retries failures; duplicates are no-ops.

### 5.3 Going live

1. Complete Razorpay KYC and switch the dashboard to **Live Mode**.
2. Generate **live** API keys and replace `RAZORPAY_KEY_ID` /
   `RAZORPAY_KEY_SECRET` in Vercel (Production environment only).
3. Create the webhook again in Live Mode — test-mode webhooks do not carry
   over. Use a **new** secret and update `RAZORPAY_WEBHOOK_SECRET`.
4. Re-deploy, then place one real ₹1,499 order with your own card/UPI and
   refund it from **Admin → Order detail → Refund**. That single round trip
   proves capture, webhook, refund and email in production.

Notes that matter in production:

- If your Razorpay account is not set to auto-capture, payments arrive as
  `authorized`; the server captures them explicitly during reconciliation.
- Razorpay cannot refund a payment older than six months.

## 6. Resend setup (transactional email)

Without `RESEND_API_KEY` the store still records every email it *would* have
sent in `email_logs` with `delivery = "skipped"`, visible in **Admin →
Emails**. Nothing is lost and no order ever fails because of email.

1. Sign up at <https://resend.com> and open **Domains → Add Domain**. Enter
   the domain you will send from (e.g. `yourdomain.com`).
2. Resend shows you the DNS records to create — typically a DKIM `TXT`
   record, an SPF `TXT` record and (optionally) a `MX`/`CNAME` for return
   path. **Copy the exact values from your own Resend dashboard**; they are
   unique per domain, so none are reproduced here.
3. Add those records in your DNS provider (GoDaddy, Cloudflare, Route 53 …)
   and click **Verify** in Resend. Propagation usually takes minutes.
4. **API Keys → Create API Key** (send-only permission is enough) →
   `RESEND_API_KEY`.
5. Set the sender identity, which must be on the verified domain:
   - `RESEND_FROM_EMAIL=orders@yourdomain.com`
   - `RESEND_FROM_NAME=Beevo`
6. Set `ADMIN_NOTIFICATION_EMAIL` to where new-order, contact-message and
   low-stock alerts should go. You can change it later without a deploy in
   **Admin → Settings**.

Customer emails: order confirmed, payment received, payment failed,
processing, shipped, out for delivery, delivered, cancelled, refunded. Owner
notifications: new order, contact message, low stock. Every send is keyed so a retried
webhook or a double-clicked button cannot send twice. Failed sends can be
retried from **Admin → Emails**.

## 7. Environment variables

`.env.example` is the authoritative list. Summary:

| Variable | Required | Used for |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (all store data) |
| `POSTGRES_URL` | — | Set automatically by the Vercel Postgres/Neon integration; wins over `DATABASE_URL` on Vercel |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical URLs, OpenGraph, sitemap, links inside emails |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ for `/admin` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ for `/admin` | Supabase publishable key (browser-safe) |
| `RAZORPAY_KEY_ID` | for online payments | Razorpay API key id |
| `RAZORPAY_KEY_SECRET` | for online payments | Razorpay API key secret (server only) |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | Verifies the raw-body HMAC signature |
| `RESEND_API_KEY` | for email delivery | Resend API key |
| `RESEND_FROM_EMAIL` | with Resend | Sender address on your verified domain |
| `RESEND_FROM_NAME` | — | Sender display name (defaults to `Beevo`) |
| `ADMIN_NOTIFICATION_EMAIL` | — | Owner alerts; overridable in Admin → Settings |
| `STORE_LEGAL_NAME` | — | Default legal name for policy pages (a fresh database only) |
| `STORE_CONTACT_EMAIL` | — | Default support email |
| `STORE_ADDRESS` | — | Default business address |
| `INITIAL_STOCK` | — | Opening stock for `npm run db:seed` |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_SUPABASE_ID` | — | Alternative to the `admin:bootstrap` CLI flags |
| `TEST_DATABASE_URL` | for `npm test` | Throwaway database; tests truncate it |

There is no admin password variable. Admin credentials live in Supabase.

## 8. Database & migrations

Scripts:

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Applies every SQL file in `drizzle/` in order. Idempotent and non-destructive. |
| `npm run db:seed` | Inserts the single product row and default store settings if they are missing. Never overwrites price or stock, and inserts no fake orders, customers or reviews. |
| `npm run db:generate` | Generates a **new** migration from changes to `src/db/schema.ts`. |
| `npm run db:studio` | Opens Drizzle Studio against `DATABASE_URL`. |
| `npm run admin:bootstrap` | Grants admin access to a Supabase user (see step 4). |

Tables: `products`, `customers`, `orders`, `order_items`, `order_events`,
`payments`, `refunds`, `inventory_events`, `email_logs`, `contact_messages`,
`webhook_events`, `admin_users`, `admin_audit_logs`, `store_settings`.

### Upgrading an existing Beevo database

`drizzle/0000_beevo_v2_baseline.sql` both creates a fresh schema **and**
upgrades an older Beevo database in place. It only adds columns, tables and
indexes, then backfills:

- every historical order keeps all of its snapshot columns,
- `customers` are derived from past orders (deduplicated by email),
- an `order_items` row is created from each order's own product snapshot,
- a legacy `razorpay_payment_id` becomes a verified, captured `payments` row,
- resolved contact messages become `status = 'resolved'`.

Nothing is dropped and no data is deleted. Take a backup first anyway, then:

```bash
DATABASE_URL="postgresql://…/your_existing_db" npm run db:migrate
```

Re-running it is a no-op. This path has been exercised against a copy of the
v1 schema with real-shaped order data.

**Do not regenerate `0000_beevo_v2_baseline.sql`** — it is hand-edited to be
idempotent and to carry the backfill. Future schema changes go into new
numbered migrations via `npm run db:generate`.

## 9. The admin panel

`/admin` — sign in with your Supabase account.

| Page | What it shows |
| --- | --- |
| Dashboard | Revenue, order counts, today's activity, low-stock and open-message warnings |
| Orders | Server-side search, filters (status, payment, date) and pagination |
| Order detail | Full timeline, items, address, payments, refunds, emails; status changes, courier/tracking, refunds |
| Payments | Every payment attempt with provider ids, capture and verification state |
| Refunds | Every refund, its provider id and status |
| Customers | Derived customer directory with order history and lifetime value |
| Product | Name, price, stock, images, specs, activation (price editing is role-gated) |
| Inventory | Current stock, adjustment form, full `inventory_events` history |
| Emails | The outbox: every send, its status, and a retry button |
| Messages | Contact-form messages with topic, status and internal notes |
| Webhooks | Every Razorpay delivery, signature result and processing outcome |
| Settings | Store name, support email, legal name, address, support hours, dispatch window, delivery estimate, replacement window, notification email |
| Admin users | Add, edit, suspend and reactivate staff (owner only) |
| Audit log | Who changed what, when |

Every mutation re-checks permission on the server, validates with Zod and
writes an audit entry.

## 10. Deploy: GitHub → Vercel

1. **Push the code.**

   ```bash
   git remote -v                       # confirm it points at your repo
   git push origin <your-branch>
   ```

2. **Import into Vercel.** <https://vercel.com/new> → *Import Git
   Repository* → pick this repo → **Import**. Framework preset is detected as
   Next.js; leave the build command and output directory alone.

3. **Add environment variables** before the first deploy: Vercel → Project →
   **Settings → Environment Variables**. Add every value from your
   `.env.local` (see the table in section 7) for the **Production**
   environment, and set `NEXT_PUBLIC_SITE_URL` to your real domain
   (`https://beevo.in`, no trailing slash). Use Razorpay **test** keys for
   Preview and **live** keys for Production if you want a safe staging
   environment.

4. **Database.** Either paste an external `DATABASE_URL` (Neon, Supabase
   Postgres, RDS …) or add Vercel's Postgres/Neon integration, which injects
   `POSTGRES_URL` automatically. The app prefers `POSTGRES_URL` on Vercel and
   switches to the serverless Neon driver for Neon-hosted databases.

5. **Deploy**, then run the migration and seed once against the production
   database from your machine:

   ```bash
   DATABASE_URL="postgresql://…production…" npm run db:migrate
   DATABASE_URL="postgresql://…production…" INITIAL_STOCK=25 npm run db:seed
   DATABASE_URL="postgresql://…production…" npm run admin:bootstrap -- \
     --email you@yourdomain.com --supabase-id <your-supabase-uid>
   ```

6. **Point your domain** at the project (Vercel → Settings → Domains) and
   update `NEXT_PUBLIC_SITE_URL` to match, then redeploy.

7. **Add the Razorpay webhook** for the production URL (section 5.2) and
   verify `https://yourdomain.com/api/health` returns `ok: true` with
   `razorpay`, `razorpayWebhook`, `resend` and `supabaseAuth` all `true`.

`vercel.json` pins the deployment region to `bom1` (Mumbai) — keep your
database in the same region for the lowest latency.

## 11. Testing

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run build         # production build

# Unit + integration tests. The integration tests need a throwaway database:
createdb beevo_test
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/beevo_test" \
  npm run db:migrate   # once, to create the schema
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/beevo_test" \
  npm test
```

> The test suite **truncates every table** in `TEST_DATABASE_URL` before each
> test file. Never point it at a database you care about. If the variable is
> missing, the database-backed tests are skipped and only the pure unit tests
> run.

What is covered (`tests/`):

- the order status machine and the role→permission matrix,
- server-side pricing, the double-submit guard and order-number format,
- stock commitment, **oversell prevention**, cancellation restock,
- payment reconciliation: idempotent confirmation, explicit capture of
  `authorized` payments, amount/currency mismatch rejection, failed payments,
  unknown orders,
- webhook duplicate delivery, unhandled event types, malformed bodies,
- refunds: full, partial, double-click, over-refund refusal, COD refusal,
  provider failure,
- email idempotency, failure recording, and orders surviving email outages.

Razorpay and Resend are stubbed at their HTTP boundary; everything below —
the reconciliation rules, the SQL, the idempotency guarantees — is the real
code running against a real PostgreSQL database.

Manual smoke test before launch: place a COD order, confirm the order number
and stock movement in the admin, walk it to *Delivered*, then place a
Razorpay test order, refund it, and check the emails and audit log.

## 12. Security notes and known limits

- **Server-side pricing.** Totals are computed from the `products` row on
  every request. The client cannot influence price, shipping or currency.
- **Payment verification.** Razorpay callbacks are verified by HMAC *and*
  re-fetched from Razorpay; amount, currency, order linkage and capture state
  are all checked before an order is confirmed.
- **Webhook signatures** are computed over the **raw request body** before it
  is parsed. Webhooks are intentionally exempt from the browser same-origin
  check applied to the site's own API routes.
- **Idempotency.** Order events, emails, refunds, webhook deliveries and
  inventory movements all carry unique keys, so retries converge instead of
  duplicating.
- **Authorisation** is re-checked on the server for every admin page and
  action; the UI is never the gate.
- **Audit trail.** Sensitive admin actions are recorded in
  `admin_audit_logs` with actor, entity and metadata.
- **Rate limiting is in-process only.** `src/lib/rate-limit.ts` keeps counters
  in memory, so on Vercel each serverless instance has its own counters and
  they reset on cold start. It raises the cost of casual abuse; it is **not**
  a distributed rate limiter. Put Vercel's WAF, Cloudflare or an external
  store in front of it if you need real guarantees.
- **PII.** Emails store the recipient, subject and a small payload — not the
  rendered customer HTML. Tracking responses omit address lines and email
  addresses and require the order number plus the phone number.
- The `admin_users` table, not Supabase, decides who may enter the admin
  panel. Suspending a row locks a person out immediately, even with a valid
  Supabase session.

## 13. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `No database URL configured` | `DATABASE_URL` missing from `.env.local` (or `POSTGRES_URL` on Vercel). |
| `/api/health` returns 503 | The app cannot reach PostgreSQL: wrong host/credentials, or the database requires `?sslmode=require`. |
| Admin login says the account has no access | The Supabase user exists but there is no active `admin_users` row — run `npm run admin:bootstrap` with that user's UID. |
| Admin login fails with "Invalid login credentials" | Wrong password, or the user was never confirmed in Supabase (tick *Auto Confirm User*). |
| Redirected to `/admin/login` in a loop | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are missing or belong to a different project, so the session cookie can't be refreshed. |
| "Pay online" is missing at checkout | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are not set, or the app wasn't restarted after setting them. |
| Payment succeeded but the order is still `payment_pending` | The callback was interrupted. Check **Admin → Webhooks**: if no delivery arrived, the webhook URL or secret is wrong. Razorpay rejects `localhost` URLs. |
| Every webhook shows an invalid signature | `RAZORPAY_WEBHOOK_SECRET` doesn't match the secret typed into the Razorpay dashboard (they are per-mode: test and live differ). |
| Emails show `skipped` in Admin → Emails | Resend isn't configured (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`). Orders are unaffected. |
| Emails show `failed` | Open the row: the provider error is stored. Usually an unverified sending domain or a `from` address outside it. Fix, then **Retry**. |
| Product page shows "Photo coming soon" | The product images aren't in `public/images/` yet — see `public/images/README.md`. |
| `npm test` fails with "relation does not exist" | Run `npm run db:migrate` against `TEST_DATABASE_URL` first. |
| Stock looks wrong | **Admin → Inventory** shows every movement with its reason and the resulting quantity; legacy orders created before the v2 upgrade have no product link and never move stock. |

## 14. Launch checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm run build` and `npm test` all pass
- [ ] Production database created, `npm run db:migrate` and `npm run db:seed` run against it
- [ ] Real stock set in **Admin → Inventory**
- [ ] Your product photos added to `public/images/` (see that folder's README)
- [ ] Supabase: signups disabled, owner account created, `admin:bootstrap` run
- [ ] Store settings filled in (legal name, address, support email and hours, dispatch and delivery windows, replacement window)
- [ ] Legal pages reviewed: `/terms`, `/privacy`, `/shipping`, `/returns`
- [ ] Razorpay **live** keys set, live webhook created with its own secret, all seven events enabled
- [ ] Resend domain verified, `RESEND_FROM_EMAIL` on that domain, `ADMIN_NOTIFICATION_EMAIL` set and tested
- [ ] `NEXT_PUBLIC_SITE_URL` equals the live domain; domain attached in Vercel
- [ ] `/api/health` returns `ok: true` with every integration you rely on `true`
- [ ] One real ₹1,499 order placed and refunded end to end, emails received
- [ ] Database backups enabled with your database provider
