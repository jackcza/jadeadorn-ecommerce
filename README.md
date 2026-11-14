# JadeAdorn — full-stack e-commerce PWA

Case-study storefront for **JadeAdorn** (beaded bracelets, natural stone, wood beads, malas and
meditation beads). Shoppers browse 7 categories / 18 products, view a product, add to a bag,
check out with a clearly-labelled **mock payment**, and land on an order confirmation that is
read from SQLite and survives refresh. The app is an installable PWA with offline browsing.

> **TEST PAYMENT — NO REAL CHARGE.** No card data is collected. Never enter real payment details.

## Quick start (≈5 minutes)

Requirements: **Node.js 20.9+** (tested with Node 22) and npm 10+. No other services.

```bash
cd jadeadorn
npm install          # installs pinned deps from package-lock.json, runs `prisma generate`
npm run setup        # creates .env from .env.example, creates prisma/dev.db, seeds the catalog
npm run dev          # http://localhost:3000
```

To try the **PWA features** (service worker, offline, install), use the production build — the
service worker is intentionally not registered in `next dev`:

```bash
npm run build
npm start            # http://localhost:3000 (localhost counts as a secure context)
```

## Why a mobile-friendly PWA

JadeAdorn's buyers mostly arrive from social posts and links on their phones, and the products are
low-ticket, impulse-friendly items. A web app opens straight from a link (no app-store install
step), shares one codebase across phone, tablet and desktop, and server-renders catalog pages for
fast first paint and SEO. The PWA layer adds home-screen install and offline browsing of products
a shopper has already looked at, without the cost of building and reviewing native apps.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` / `npm start` | Production build / server (needed for the service worker) |
| `npm run setup` | `.env` (if missing) → `prisma generate` → `prisma db push` → seed |
| `npm run db:seed` | Upsert the catalog (idempotent, safe to re-run) |
| `npm run db:reset` | Delete the local SQLite file, recreate the schema and reseed (orders are lost) |
| `npm run lint` | ESLint (zero warnings) + `tsc --noEmit` |
| `npm test` | Vitest unit + integration tests (uses its own `prisma/test.db`) |
| `npm run test:e2e` | Playwright E2E on 375px and 1440px (builds the app, uses `prisma/e2e.db`, port 3100). First run: `npx playwright install chromium` |

## Environment variables

Neither is a secret (`.env.example`):

| Name | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite file, relative to `prisma/schema.prisma` |
| `LOG_LEVEL` | `debug` in `npm run dev`, `info` in production | Log verbosity, see [Logging](#logging) |

There are no payment keys: the mock provider needs none.

## Using the mock payment

At checkout, the payment section is labelled **TEST PAYMENT — NO REAL CHARGE** and offers two
test cards:

- **Test card — payment approved** (`tok_mock_success`): the order is created and you are taken to
  `/orders/<publicId>`.
- **Test card — payment declined** (`tok_mock_decline`): the API answers `402 PAYMENT_DECLINED`, the
  page shows an error, **nothing is written to the database**, and your bag is kept so you can retry.

From the command line (replace `<productId>` with an id from `GET /api/products`):

```bash
curl -X POST http://localhost:3000/api/checkout -H 'content-type: application/json' -d '{
  "idempotencyKey": "demo_key_0000000001",
  "customer": { "fullName": "Jamie Chen", "email": "jamie@example.com", "addressLine1": "123 Main St",
                "city": "Boston", "state": "MA", "postalCode": "02110", "country": "US" },
  "items": [{ "productId": "<productId>", "quantity": 2 }],
  "payment": { "provider": "mock", "token": "tok_mock_decline" }
}'
```

Sending the same `idempotencyKey` again returns the same order (`200`, `"replayed": true`) instead of
creating a second one.

## API

All errors use one shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details"?: … } }`.

| Method & path | Notes |
| --- | --- |
| `GET /api/categories` | 7 categories with active product counts |
| `GET /api/products` | All active products |
| `GET /api/products?category=<slug>` | Products in one category (`404` for an unknown slug) |
| `GET /api/products/<slug>` | One product (`404` if missing or inactive) |
| `POST /api/checkout` | Validate (Zod) → reprice from DB → mock charge → create `Order` + `OrderItem`s in one transaction. `201` new, `200` idempotent replay, `400` validation, `402` declined, `409` product unavailable, `403` cross-origin, `413` too large. Every response carries an `X-Request-Id` header |
| `GET /api/orders/<publicId>` | Order for the confirmation page (`no-store`; no internal ids) |

Pages: `/`, `/products`, `/category/<slug>`, `/products/<slug>`, `/cart`, `/checkout`,
`/orders/<publicId>` (confirmation), `/offline`.

## Logging

The API logs structured JSON with [Pino](https://getpino.io), through one module: `src/lib/logger.ts`.
Logs go to stdout only. Nothing is written to SQLite or to log files.

**Configuration.** `LOG_LEVEL` accepts `debug`, `info`, `warn`, `error` (case-insensitive) or `silent`. Set it
in the shell or in `.env`. Unknown values fall back to the default: `debug` under `npm run dev`, `info` in
production. In development the lines are pretty-printed by `pino-pretty`, a dev dependency that is only
loaded when `NODE_ENV=development`. In production (`npm start`) every line is one JSON object. `npm test`
runs with `LOG_LEVEL=silent`, and the logging tests capture lines in memory instead.

| Level | Used for |
| --- | --- |
| `debug` | Diagnostic detail: a checkout body passed validation (line and item counts) |
| `info` | Normal business events: checkout started, payment succeeded, order created or replayed |
| `warn` | Expected failures: payment declined, or checkout rejected (invalid input, unavailable product, cross-origin, too large) |
| `error` | Server failures: unexpected API errors (with stack), database errors, a checkout that failed after payment |

Every line has `level`, `timestamp` (ISO 8601, UTC), `service`, `event` and `msg`. API lines add
`requestId` and `route`.

| `event` | Level | Logged when | Extra fields |
| --- | --- | --- | --- |
| `checkout_started` | info | `POST /api/checkout` arrives | |
| `checkout_validated` | debug | the body passed Zod validation | `lineCount`, `itemCount` |
| `payment_succeeded` | info | the mock provider approved the charge | `provider`, `amountCents`, `currency`, `durationMs` |
| `payment_failed` | warn | the mock provider declined the charge | the same, plus `reason` |
| `order_created` | info | `Order` + `OrderItem`s were committed | `orderId`, `orderNumber`, `totalCents`, `currency`, `durationMs` |
| `order_replayed` | info | a known idempotency key returned the existing order | the same as `order_created` |
| `order_creation_failed` | warn (4xx), error (5xx) | a checkout ended without an order | `status`, `errorCode`, `durationMs` |
| `api_error` | error | an API route hit an unexpected error and answered `500` | `status`, `errorCode`, `err` (type, message, stack) |
| `database_error` | error | a Prisma / SQLite call failed | `status`, `errorName`, `prismaCode`, `model` |

Each checkout request gets a new UUID `requestId`, which is also returned in the `X-Request-Id` response
header. `durationMs` measures the provider call on payment events and the whole request on `order_*`
events. Expected 4xx answers from the catalog and order routes (such as an unknown product) are normal
responses and are not logged. A successful checkout in production looks like this:

```json
{"level":"info","timestamp":"2026-11-14T07:12:24.668Z","service":"jadeadorn","requestId":"2d0a9787-63d5-4f29-9993-929573a33aad","route":"POST /api/checkout","event":"checkout_started","msg":"Checkout started"}
{"level":"info","timestamp":"2026-11-14T07:12:24.676Z","service":"jadeadorn","requestId":"2d0a9787-63d5-4f29-9993-929573a33aad","route":"POST /api/checkout","event":"payment_succeeded","provider":"mock","amountCents":9600,"currency":"USD","durationMs":0,"msg":"Payment succeeded"}
{"level":"info","timestamp":"2026-11-14T07:12:24.689Z","service":"jadeadorn","requestId":"2d0a9787-63d5-4f29-9993-929573a33aad","route":"POST /api/checkout","event":"order_created","orderId":"cmwg2iwdi0000aickyz7fpj3w","orderNumber":"JA-261114-7QH3SH","totalCents":9600,"currency":"USD","durationMs":21,"msg":"Order created"}
```

**Never logged:** the shipping address, customer name and email, payment tokens or card data,
`Authorization` headers, cookies, passwords, and the idempotency key or order `publicId`. Either of the
last two is enough to read an order and the customer's details. Log calls pass only the fields listed
above. As a safety net, Pino `redact` replaces those keys with `"[REDACTED]"` at the top level and two
levels down (for example `customer`, `payment.token`, `req.headers.cookie`). Database errors log the
Prisma error code and model but not the message, because Prisma messages can echo query values.

**Viewing logs:**

```bash
npm run dev                          # pretty and colorized, debug lines included
LOG_LEVEL=warn npm run dev           # warnings and errors only (PowerShell: $env:LOG_LEVEL="warn"; npm run dev)
npm run build && npm start           # JSON lines on stdout
npm start | npx pino-pretty          # read production output in the pretty format
npm start | grep '"event":"order_'   # filter by event (PowerShell: npm start | Select-String '"event":"order_')
```

To follow one checkout, copy `X-Request-Id` from the response (browser dev tools → Network) and search
the logs for it.

## Tests

```bash
npm run lint       # eslint + typecheck
npm test           # 53 Vitest tests (9 files)
npm run test:e2e   # 10 Playwright tests (5 specs × mobile-375 and desktop-1440)
```

Vitest covers: DB init + idempotent seed, category queries, product detail, cart persistence
(localStorage + provider remount), checkout success, mock payment failure (nothing persisted),
order persistence + name/price snapshots, duplicate submit (sequential and concurrent) creates one
order, server-side repricing (client prices ignored), inactive products, validation errors, the PWA
manifest/icons and service-worker caching rules, and the offline-blocked checkout UI. The logging tests
cover `LOG_LEVEL` parsing and filtering, the JSON fields, redaction, the event sequence for success,
decline, replay and rejected checkouts, a real database failure after payment (the `OrderItem` table is
renamed for one request), and that no customer details, payment token, idempotency key or `publicId`
reach the output.

Playwright covers the full mobile and desktop purchase (category → detail → bag → checkout → pay →
confirmation → refresh), decline then retry, empty bag / 404, service-worker registration, and
offline browsing with checkout blocked.

## PWA

- `app/manifest.ts` → `/manifest.webmanifest`: name, short_name, `start_url: "/"`, `display:
  standalone`, theme `#354d40`, background `#fbf9f5`, 192/512 PNG icons + a maskable icon, and an
  apple-touch icon (`scripts/generate-icons.mjs`, no image dependencies).
- `public/sw.js`, hand-written and unit-tested:
  - **Static assets** (`/_next/static`, icons, product SVGs, manifest): cache-first.
  - **Catalog API GETs** (`/api/categories`, `/api/products*`): network-first, cached fallback.
  - **Public pages** (home, catalog, product, category, cart and checkout shells): network-first,
    cached when visited (including in-app link navigations), else the `/offline` page.
  - **Never cached**: `/api/checkout`, `/api/orders/*`, `/orders/*` confirmation pages, and any
    non-GET request. Those responses also carry `Cache-Control: no-store` and
    `X-JadeAdorn-Sensitive: 1`, which the worker refuses to store.
- Offline: a banner appears, cached pages and the bag (localStorage) keep working, and the checkout
  button is disabled with "Payment requires an internet connection". The submit handler also checks
  `navigator.onLine`, and a failed request never produces a local "fake" order.
- Install: Chromium browsers get an **Install** button via `beforeinstallprompt`. iOS Safari has no
  install API, so it shows an "Share → Add to Home Screen" hint. Both are hidden once installed.

**Limits:** no push notifications or background sync (not required). Offline only covers pages and
data you already viewed online. The cache name is versioned by hand (`VERSION` in `sw.js`), so bump
it when changing caching behaviour. `navigator.onLine` can report "online" on a captive portal, in
which case the request fails and the user sees a retryable network error.

## Demo assumptions

- **Shipping and tax are always $0** (`src/lib/money.ts`). The order still stores
  `shippingCents`/`taxCents`, so real rules can be added later.
- **Price normalization:** the prototype's *Jade-Tone Bracelet Gift Set* was **$89**; it is seeded at
  **$78** to match the brief's ~$29–$78 range. The other 17 prices match the prototype (the $84
  Sandalwood & Stone Mala is kept as-is, since the brief's range is approximate).
- Product art is generated placeholder SVG (`scripts/generate-art.ts`), not photography.
- Product descriptions are neutral copy and make no health or spiritual claims.
- Order confirmation URLs use a random 144-bit `publicId`. That is a demo trade-off; production would
  add sign-in or an emailed one-time link.
- A declined payment does not create an order row. The next attempt uses a fresh idempotency key.

## Resetting the database

```bash
npm run db:reset    # deletes prisma/dev.db, recreates it, reseeds 7 categories / 18 products
```

## Project layout

```
jadeadorn/
├── prisma/            schema.prisma (Category, Product, Order, OrderItem), seed.ts
├── public/            sw.js, icons/, images/ (placeholder SVGs)
├── scripts/           ensure-env, reset-db, generate-icons, generate-art, capture-demo
├── src/app/           pages + api/ route handlers + manifest.ts
├── src/components/    cart/, catalog/, checkout/, layout/, pwa/
├── src/data/          catalog seed data + SVG art
├── src/lib/           db, catalog, orders (checkout service), mock-payment, validation, money, cart,
│                      logger, payment-logging, errors
├── tests/             Vitest unit + integration
└── e2e/               Playwright specs
```

## Deliberate cuts

Not built, per the brief's priorities: accounts/login, admin, inventory, coupons, reviews, search,
sort and price filters, wishlist, newsletter, real payments, emails, and cloud deployment. See
`DESIGN_NOTE.md` for how production would handle hosting, HTTPS, Stripe, inventory and fulfillment.

## Known dev-dependency advisories

`npm audit` reports advisories only in dev and test tooling: Vitest 3 / tinypool and
typescript-eslint's minimatch. The patched Vitest 4.1.12 could not be installed because npm 10
crashes resolving its peer dependencies. `npm audit --omit=dev` (runtime dependencies) reports 0
vulnerabilities. A `deepmerge-ts` override patches the Prisma CLI and a `postcss` override patches
Next's bundled copy.
