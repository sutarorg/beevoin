# Beevo — architecture & migration notes

This document records the *existing* architecture, the *target* architecture and
the migration decisions taken during the production upgrade. It is the companion
to `README.md` (which is the operator-facing deployment guide).

---

## 1. Existing architecture (before this upgrade)

| Concern | Implementation |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript, Tailwind v4 |
| Data | PostgreSQL + Drizzle ORM (`orders`, `order_events`, `email_logs`, `contact_messages`) |
| Schema management | `drizzle-kit push` only — no migration files |
| Product data | Hard-coded in `src/lib/config.ts` (`priceInPaise: 149900`) |
| Checkout | `/api/checkout` — creates order, then Razorpay order |
| Payments | Direct Razorpay REST calls, HMAC verification + server-side payment fetch |
| Payment record | Razorpay ids stored directly on `orders` |
| Webhooks | **None** |
| Refunds | **None** |
| Inventory | **None** |
| Customers | **None** (order rows only) |
| Admin auth | `ADMIN_PASSWORD` + HMAC-signed `beevo_admin` cookie |
| Admin UI | Orders list + order detail + status form |
| Email | Direct Resend REST call, outbox in `email_logs` |
| Contact form | Web3Forms + `contact_messages` |
| Audit | None |

What was already sound and has been **preserved**: integer paise money, the
server-side payment verification chain, the order-number + `lookup_secret`
privacy model, Zod validation, same-origin guards, security headers, the Vercel
`bom1` region pin, and the entire customer-facing storefront design.

---

## 2. Target architecture

One source of truth per concern:

| Concern | Source of truth |
| --- | --- |
| Identity (who are you) | **Supabase Auth** (`@supabase/ssr`, cookie SSR sessions) |
| Authorization (what may you do) | `admin_users` table + server-side role/permission checks |
| Product & commercial data | PostgreSQL + Drizzle (`products`) |
| Orders | PostgreSQL + Drizzle (`orders`, `order_items`, `order_events`) |
| Payment truth | Razorpay + internal `payments` table |
| Payment events | Razorpay webhooks + idempotent `webhook_events` table |
| Refunds | Razorpay refunds API + `refunds` table |
| Inventory | `products.inventory_quantity` + append-only `inventory_events` |
| Email delivery | Resend |
| Email history | `email_logs` (idempotent on `event_key`) |
| Audit | `admin_audit_logs` |
| Source control | GitHub `sutarorg/beevoin` |
| Runtime | Vercel (`bom1`) |

**Supabase Auth is used for identity only.** Drizzle/PostgreSQL remains the
application data layer; no query was migrated to `supabase.from(...)`. The
`DATABASE_URL` may point at any Postgres (Neon, Supabase Postgres, RDS…).

---

## 3. Auth transition

| Before | After |
| --- | --- |
| `ADMIN_PASSWORD` compared with `timingSafeEqual` | Supabase Auth email + password |
| `beevo_admin` HMAC cookie | Supabase SSR auth cookies |
| `isAdmin(): boolean` | `requireAdmin()` → `AdminActor { id, role, email, name }` |
| No roles | `owner` / `admin` / `support` / `fulfillment` |
| No status | `active` / `suspended` |

`src/lib/admin-auth.ts` and `/api/admin/{login,logout}` were **deleted** — there
is no dual authentication path. `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` are
gone from code, `.env.example` and the README.

Verification uses `supabase.auth.getClaims()` (asymmetric-JWT verified claims)
with a `getUser()` fallback, per current Supabase guidance — `getSession()` is
never used for an authorization decision.

`src/proxy.ts` (Next.js 16 replaces `middleware.ts`) refreshes the Supabase
session on `/admin/*` and redirects unauthenticated visitors to
`/admin/login`. The proxy is a *convenience* boundary only: every page, server
action and route handler re-checks authorization server-side.

---

## 4. Payment transition

```
checkout (COD)     : verified mobile OTP -> pending -> confirmed (inventory reserved once)
checkout (online)  : pending -> payment_pending        (no inventory yet)
payment success    : payment_pending -> confirmed      (inventory reserved once)
```

`order.status` and `payment.status` are separate:

* order status — `pending`, `payment_pending`, `confirmed`, `processing`,
  `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `refunded`
* payment status — `pending`, `authorized`, `captured`, `failed`, `refunded`,
  `partially_refunded`

Two independent sources report a payment: the browser callback
(`/api/payments/razorpay/verify`) and the Razorpay webhook
(`/api/webhooks/razorpay`). Both funnel into a single reconciliation service,
`reconcileRazorpayPayment()` in `src/lib/services/payments.ts`, which:

1. loads the payment from Razorpay server-side (never trusts the caller);
2. checks amount, currency, order linkage and capture state;
3. upserts the `payments` row (unique on `provider_payment_id`);
4. captures an `authorized` payment when the account uses manual capture;
5. confirms the order + reserves inventory inside one transaction, exactly once;
6. queues the transactional email with a deterministic idempotency key.

Whichever source arrives first wins; every later arrival is a verified no-op.

---

## 5. Email transition

* Delivery provider: Resend, via the official `resend` SDK.
* `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`,
  `ADMIN_NOTIFICATION_EMAIL` replace the ambiguous `EMAIL_FROM`.
* Web3Forms removed; contact notifications go through Resend.
* Idempotency: `email_logs.event_key` is `UNIQUE`, built as
  `orderId:template:stateVersion`. A duplicate insert is caught and the send is
  skipped, so retries/webhook replays can never double-send.
* Email failure never rolls back an order or a payment. Failures are recorded
  with `delivery = 'failed'` and are retryable from `/admin/emails`.
* Rendered HTML is **not** persisted (PII minimisation); retries re-render from
  the order + template.

---

## 6. Database changes

New tables: `products`, `customers`, `order_items`, `payments`, `refunds`,
`inventory_events`, `webhook_events`, `admin_users`, `admin_audit_logs`,
`store_settings`, `cod_phone_verifications` (hashed one-time COD OTP tokens).

Additive columns on existing tables only — **no destructive change**:

* `orders`: `product_id`, `customer_id`, `confirmed_at`, `cancelled_at`,
  `shipped_at`, `delivered_at`, `refunded_in_paise`, `inventory_reserved_at`,
  `inventory_released_at`.
* `order_events`: `previous_status`, `actor`, `actor_admin_id`.
* `email_logs`: `event_key` (unique), `provider_message_id`, `attempts`,
  `last_attempt_at`; `html` relaxed to nullable.
* `contact_messages`: `status`, `resolved_at`, `resolved_by_admin_id`,
  `notified_at`.

Migrations live in `drizzle/` and are applied with `npm run db:migrate`
(`drizzle-orm` migrator). Every statement is written to be idempotent
(`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), so the same migration set is
safe on a fresh database *and* on the existing production database that already
contains `orders`, `order_events`, `email_logs` and `contact_messages`.

`npm run db:seed` inserts the single Beevo Go product (SKU `BG-GO-01`,
`99900` paise online and `129900` paise by COD). The payment-method price is
selected server-side at checkout, and each order keeps its immutable unit-price
snapshot.

---

## 7. Concurrency & idempotency guarantees

| Risk | Mitigation |
| --- | --- |
| Double-click checkout | 90 s dedupe window keyed on customer + total + method |
| COD OTP replay | Signed 15-minute token is stored only as a hash and consumed once inside the order transaction |
| Overselling the last unit | `UPDATE products SET inventory_quantity = inventory_quantity - $n WHERE id = $id AND inventory_quantity >= $n` inside a transaction, with an affected-row check |
| Double inventory decrement | `orders.inventory_reserved_at` guard inside the same transaction |
| Duplicate webhook | `webhook_events (provider, event_id)` UNIQUE + `processed` flag |
| Duplicate payment row | `payments.provider_payment_id` UNIQUE |
| Payment reused on another order | `payments.provider_payment_id` UNIQUE + order linkage check |
| Duplicate refund | `refunds.provider_refund_id` UNIQUE + refundable-amount check inside a transaction |
| Duplicate email | `email_logs.event_key` UNIQUE |
| Duplicate order event | `(order_id, status, previous_status)` guard for automated transitions |
| Illegal status transition | `ALLOWED_TRANSITIONS` enforced server-side in `transitionOrderStatus()` |

---

## 8. Known limitations (documented honestly)

* `src/lib/rate-limit.ts` is an **in-memory** limiter. On Vercel each serverless
  instance has its own memory, so it is a *per-instance* first layer, not a
  globally distributed limit. The interface (`rateLimit()` /
  `setRateLimitStore()`) allows a Redis/Upstash store to be plugged in later
  without touching a single call site.
* Refunds are initiated synchronously; Razorpay may report `pending` and settle
  later. The `refund.processed` / `refund.failed` webhooks finalise the state.
* Beevo is a single-product store. `order_items` exists so multi-product is a
  data change rather than a rewrite, but the storefront/cart remain single-SKU.
