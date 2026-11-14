# JadeAdorn — Design Note

**Goal:** a mobile-first storefront where a shopper can browse JadeAdorn's 7 categories and 18
products, add to a bag, pay with a mock provider, and see a persisted order. It is built as a
single deployable Next.js app and is an installable PWA.

## Technology Choices

- **Next.js 15 (App Router) + React 19 + TypeScript.** Server Components render catalog pages
  straight from the database, so first paint is fast and SEO-friendly. Route Handlers provide the
  REST API in the same codebase, and the small amount of client code (bag, checkout form, PWA hooks)
  is in Client Components.
- **Tailwind CSS 4**, using the prototype's palette (deep jade `#354d40`, warm white, gold) and
  Georgia headings. The same code covers 375px through 1440px.
- **Prisma 6 + SQLite.** Typed queries, transactions and a one-command setup with no external
  services. **Zod** schemas validate requests and are shared by the checkout form and the API, so
  client and server enforce the same rules.
- **Vitest** (unit + integration against a real SQLite file) and **Playwright** (mobile and desktop
  E2E).

## Data Model

Four tables: `Category 1─N Product`, `Order 1─N OrderItem`, `Product 1─N OrderItem`.

- Money is **integer cents** everywhere (`priceCents`, `subtotalCents`, `shippingCents`, `taxCents`,
  `totalCents`) with a `currency` column. There is no floating-point arithmetic.
- `OrderItem` snapshots `productName` and `unitPriceCents`, so later catalog edits never rewrite
  order history.
- `Order.publicId` is 144 random bits (base64url) and is used in URLs instead of the internal id.
  `orderNumber` (`JA-YYMMDD-XXXXXX`) is human-friendly. `idempotencyKey` is unique.
- `Product.isActive` soft-disables a product without breaking historical orders.

## Architecture

```
Browser (React, bag in localStorage) ──► Next.js Route Handlers ──► lib/orders.placeOrder ──► Prisma ──► SQLite
        ▲   service worker (public/sw.js)                              └─► PaymentProvider (mock)
```

`POST /api/checkout` validates the body with Zod. Unknown fields such as a client `priceCents` are
stripped. It then loads the products, **reprices them on the server**, and rejects inactive or
unknown ids (`409`). Next it charges the `PaymentProvider` with the server total and the idempotency
key. Only on success does it create `Order` + `OrderItem`s in a **single DB transaction**. A decline
returns `402` and writes nothing.

**Duplicate submits:** the client keeps one key per checkout attempt in `sessionStorage`. The
server returns the existing order for a known key, and a unique-constraint race between concurrent
requests resolves to the winner's order. The tests cover both the sequential and the concurrent
case.

**PWA:** static assets are cache-first; catalog APIs and public pages are network-first with a
cache fallback. Checkout, order APIs and confirmation pages are never cached (they also send
`no-store` plus a sensitivity header). Offline, the pay button is disabled.

## Production Hosting

Either option works without changing the app's architecture:

- **Vercel:** natural fit for Next.js. Use managed Postgres (Neon or Vercel Postgres) and
  per-PR preview deployments.
- **AWS:** a container on ECS Fargate (or App Runner) behind an ALB, RDS PostgreSQL (Multi-AZ,
  automated backups, PITR), CloudFront for `/_next/static` and images, and Secrets Manager for keys.

For both: **move SQLite to PostgreSQL** by changing the Prisma `provider`, then switch to
`prisma migrate` with checked-in migrations run in CI/CD. Add connection pooling (PgBouncer or
Prisma Accelerate), structured logs, error tracking (Sentry), uptime checks and alerting.

## HTTPS

TLS terminates at Vercel or CloudFront/ALB with ACM-managed certificates. Production also needs:

- HTTP→HTTPS redirect.
- HSTS (with preload once stable).
- Secure, HttpOnly, SameSite cookies when sessions arrive.
- A CSP.

Service workers and install prompts require HTTPS in production; `localhost` is exempt for
development.

## Inventory Management

Add `stockQuantity` (or an `Inventory` table per SKU/variant) and an `InventoryReservation` with
an expiry:

- **Reserve at checkout start:** a conditional decrement in the same transaction, e.g.
  `UPDATE … SET stock = stock - n WHERE stock >= n`.
- **Commit on payment success.**
- **Release on failure or timeout** with a scheduled job.

Show "low stock" and "sold out" states, block over-sell at the database level, and add an admin
screen or ERP sync for restocks.

## Stripe Integration

Replace `createMockPaymentProvider()` behind the existing `PaymentProvider` interface:

1. The server creates a **PaymentIntent** (or a Checkout Session) for the **server-computed** total,
   passing our `idempotencyKey` as Stripe's `Idempotency-Key`. Persist the order as
   `PENDING_PAYMENT` with the intent id.
2. The client confirms with **Stripe Elements / Payment Element**, so card data never touches our
   servers (PCI SAQ A) and 3-D Secure is handled.
3. A **webhook** (`payment_intent.succeeded`, `…payment_failed`, `charge.refunded`), with the
   signature verified using the endpoint secret, is the **source of truth**. It moves the order to
   `PAID`/`FAILED`, idempotently keyed on the event id. The confirmation page shows "processing"
   until the webhook lands.
4. Keys stay in the secret store. Use test mode in staging and live keys only in production.

## Order Handling

Order states grow from `CONFIRMED` to: `PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED`,
plus `CANCELLED`/`REFUNDED`.

On `PAID`, enqueue jobs to:

- Send the confirmation email (Postmark or SES).
- Notify the warehouse or 3PL.
- Record tax (Stripe Tax or Avalara).

Shipping labels and tracking numbers (EasyPost/Shippo) feed "shipped" emails. Customers get an
order-lookup link (signed or emailed) or an account. Staff get a protected admin for refunds and
cancellations, with an audit log.

## Future Improvements

- Real product photography via a CDN, plus `next/image`.
- Search, filters and sort.
- Accounts and order history.
- Real shipping and tax rules.
- Discount codes.
- Rate limiting and bot protection on checkout.
- Analytics and conversion funnel.
- Accessibility audit.
- Build-hash cache versioning for the service worker (or Workbox), plus background sync for
  non-payment actions.
- Price-change detection in the bag before checkout.
- Load tests on Postgres.
