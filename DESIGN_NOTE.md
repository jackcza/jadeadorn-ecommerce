# JadeAdorn — Design Note

## Goal and Product Choice

I chose **JadeAdorn** and built a mobile-first web storefront for its 7 categories and 18 products.
Customers can browse by category, view a product, keep a bag across refreshes, complete a clearly
labelled mock payment, and reopen the persisted order confirmation.

A responsive PWA fits this brand better than separate native apps: customers can open a social or
shared link immediately, one codebase covers mobile and desktop, server-rendered catalog pages are
fast and indexable, and repeat visitors can install the app and browse previously visited products
offline.

## Technology and Architecture

**Next.js 15, React 19 and TypeScript** provide Server Components for catalog pages, Client
Components for the bag and checkout, and Route Handlers for the API in one deployable application.
**Tailwind CSS 4** implements the prototype's visual language responsively. **Prisma 6 + SQLite**
give typed queries, transactions and a no-service local setup; **Zod** shares validation rules
between the form and API. **Vitest** covers unit/integration behavior and **Playwright** exercises
mobile and desktop purchase flows.

```text
Browser (React + localStorage) → Next.js API → orders.placeOrder → Prisma → SQLite
          service worker                             ↘ mock PaymentProvider
```

SQLite and the mock provider are deliberate review-time choices, not the proposed production
infrastructure.

## Data Model

The four tables are `Category 1─N Product`, `Order 1─N OrderItem`, and
`Product 1─N OrderItem`. Money is stored as integer cents with a currency, avoiding floating-point
errors. `OrderItem` snapshots product name and unit price so catalog edits do not rewrite history.
`Product.isActive` supports soft removal. Orders have an unguessable public URL id, a readable order
number, and a unique idempotency key.

## Key Design Decisions

`POST /api/checkout` validates with Zod, discards untrusted client price fields, reloads active
products, and recalculates the total on the server. A successful mock payment creates the order and
items in one database transaction; a decline writes nothing. The client reuses one idempotency key
per checkout attempt, while a database unique constraint resolves duplicate or concurrent submits
to the same order.

The service worker caches static assets and public catalog content, but checkout, order APIs and
confirmation pages are network-only and marked `no-store`; payment is disabled offline. Structured
Pino logs carry a request id and redact customer, payment and credential fields. In production,
stdout logs would feed CloudWatch or Datadog, with Sentry and alerts for checkout errors, payment
mismatches and latency.

## Production Handoff

- **Hosting and scale:** Deploy the stateless Next.js app on Vercel or multiple ECS Fargate
  instances behind an ALB. Move SQLite to managed PostgreSQL, use checked-in Prisma migrations,
  connection pooling, indexes, Multi-AZ backups and point-in-time recovery. Put static assets behind
  a CDN and cache read-heavy catalog data in Redis with explicit invalidation. Rate-limit checkout
  and load-test throughput, inventory contention, connection usage and p95/p99 latency.
- **HTTPS:** Terminate TLS at Vercel or CloudFront/ALB with managed certificates, redirect HTTP to
  HTTPS, and add HSTS and CSP. Future session cookies must be Secure, HttpOnly and SameSite.
- **Inventory:** Add per-SKU stock and expiring reservations. Use an atomic conditional update to
  reserve available stock, mark the reservation consumed after payment, and release it after failure
  or timeout. This prevents overselling under concurrent requests; an admin or ERP integration
  manages restocking.
- **Payments:** Replace the mock implementation behind `PaymentProvider` with Stripe PaymentIntent
  and Payment Element. Create a `PENDING_PAYMENT` order from the server-computed total, pass the
  checkout key to Stripe for idempotency, and treat signature-verified, event-idempotent webhooks as
  the source of truth. Keep keys in the platform secret store.
- **Order handling:** Expand states to
  `PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED`, plus `CANCELLED` and `REFUNDED`.
  After payment, enqueue email, warehouse/3PL, tax and shipping tasks. Idempotent workers use bounded
  retries and a dead-letter queue; staff receive a protected refund/cancellation UI with an audit
  log, while customers receive a signed lookup link or account history.

## Next Steps

The first production milestones are PostgreSQL migrations, Stripe test-mode webhooks, inventory
reservations, queued email/fulfillment jobs, and monitoring/load tests. With more product time I
would add real CDN-hosted photography, accounts and order history, shipping/tax rules, search and
filters, discounts, analytics, and a full accessibility review.
