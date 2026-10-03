# Printique — Architecture

This document describes how the app is structured and why, so maintainers can extend it without breaking its guarantees.

## 1. The layered rule

```
app/                      ← HTTP: Route Handlers, Server Components, layouts, pages
  └─ lib/services/        ← use cases; transactions; provider selection
       └─ lib/providers/  ← payment / email / AI abstractions (env-chosen)
       └─ lib/db/repositories/*
                           ← the ONLY code that writes SQL; every row mapping lives here
            └─ lib/domain/← pure logic: pricing, coupons, order FSM, errors
```

**Dependencies point inward.** A page may never import a repository (it would bypass invariants); domain/business logic never touches Next APIs (it is directly testable); providers are injected by env so the same flow works locally and in production.

**Repositories are seams, not dead weight.** Swapping the engine (SQLite → Postgres) requires replacing `lib/db/repositories/*`'s SQL, then a `dbUrl` env — no domain change. Check `lib/db/client.ts` and `lib/db/migrations.ts` for the current SQLite schema.

## 2. Runtime shape

```
            ┌─ Next.js 16 (App Router, RSC-first)
            │       app/
browser ────┤   pages (RSC data)   ┌──────────────┐
            │   /api/v1/*          │ Vitest proves │
webhooks ───┤   providers/mock|stripe│env.SITE_URL │
            └──────────────────── └──────────────┘
                     │
                 Node runtime (instrumentation → migrate() + email worker)
                     │
               SQLite (WAL) on DATA_DIR volume
```

- **Everything server-side above SQLite is per-request or per-process**; no Vercel/edge constraints. Node 18+ (runs on Node 22/24) — we pin Node 24 in `.nvmrc`/Dockerfile.
- **Instrumentation hook** (`instrumentation.ts`) applies migrations and starts the background email worker at boot — the image carries zero data.
- **WAL mode + busy_timeout** makes single-box writes safe; `withTransaction` uses `BEGIN IMMEDIATE` so two concurrent checkouts of the same last-in-stock variant cannot both succeed.

## 3. Commerce flows (where correctness lives)

### Cart → Order
1. `resolveCart()` merges a guest cart token and the signed-in user's cart, returning one authoritative cart.
2. `createOrderFromCart()` **inside a transaction**: re-computes each line from the DB (product+variant prices), re-validates coupon constraints (min subtotal, redemption caps, per-user limit), checks stock, and reserves it. Order line items **snapshot** unit prices at purchase time.
3. Idempotency: order creation accepts the client's `idempotencyKey`; duplicates (`ecommerce.post('/orders')` retries, refreshes) return the original order instead of re-charging.

### Payment lifecycle (provider-abstracted)
- `lib/providers/payments/index.ts` — env-selects `stripe` or `mock`.
- `createIntent()` returns a checkout URL (mock's hosted pay page lives in-app for dev; Stripe's is externally hosted).
- **Webhooks are the only payment source of truth** (`/api/v1/webhooks/payments/[provider]`): HMAC signatures verified (safe-compare), event-level idempotency table, **amount + currency cross-check against the order** before the FSM's `MARK_PAID`. A mismatch marks `IGNORED` and writes `PAYMENT_AMOUNT_MISMATCH` to the audit log.
- `MARK_PAID` also releases inventory from reserved → sold, enqueues the confirmation email, records the purchase analytics event, and notifies the customer.

### Order state machine (`lib/domain/order-fsm.ts`)
Explicit table: `PENDING → CONFIRMED → (PROCESSING) → (SHIPPED) → (DELIVERED)` with `CANCELLED` branches, payment stripe `PENDING/PAID/FAILED/REFUNDED`, and denial reasons built into each guard — which is why the admin UI can offer only legal buttons (see `app/admin/orders/[id]/transition-buttons.tsx`), and the customer-side cancel button only renders when the transition is legal for that order.

## 4. Security model

- **Roles:** `CUSTOMER` default; `ADMIN` (server-revalidated in `app/admin/layout.tsx` *and* inside every `app/admin/actions.ts` function — layouts are never the boundary).
- **IDOR prevention:** order pages accept either the owning session, an `ADMIN`, or an HMAC-signed access token (`orderAccessToken` — used in guest confirmation links; the order id alone is not enough).
- **Auth layers:** bcrypt cost 12; login attempts lock out after 5; reset/verify tokens are hashed in the DB with short TTLs; password changes destroy other sessions **and** re-verify.
- **Uploads** cap at 4MB, restricted to JPEG/PNG/WebP, magic-byte sniffed, clamped to reasonable dimensions, renamed server-side (`seed`-like prefixes), exposed only through the `/api/media/[key]` reader that validates ownership/usage for uploads.
- **Headers** (`next.config.ts`): CSP (`default-src 'self'`, `frame-ancestors 'none'`, font/style allowlists exactly as needed), nosniff, DENY framing, referrer policy, permissions-policy, HSTS in production.
- **Rate limiting** (in-memory, per IP/user) on auth, orders, assistant, uploads, and suggest; documented as a CDN/WAF consideration for multi-instance deployments.
- **Audit log** rows (`lib/db/repositories/engagement.ts`) annotate every security-relevant mutation and admin action with actor, entity, and a metadata payload.

## 5. AI — grounded, tool-called

- `lib/providers/ai/openai-compatible.ts` implements one narrow interface (`chat({messages, tools})`, `generate(prompt)`) over any `/v1/chat/completions` endpoint (OpenAI, OpenRouter, local). Configure via `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
- The shopping assistant (`lib/services/assistant.ts`) presents the catalog API as **function-calling tools** whose arguments are names/sizes — never free text. Replies cite grounded product cards computed by code; text is free-form but cannot carry actionable business data on its own — if the model is junk, you get a polite sentence and **the same product list**.
- No AI key? The `fallback` provider parses natural-language constraints (`color`, `material`, `type`, `maxPrice`) into real catalog queries. It labels responses `template mode` — the UI (assistant page) displays this.
- Admin content tool: model drafts from **structured attributes**; the output surfaces as an editable draft with a review-required note, and the audit log records generations.

## 6. Testing pyramid (Vitest)

- **Unit** (`tests/unit/`): pricing arithmetic incl. tax/shipping thresholds; coupon condition table; password + zod schemas; the full FSM matrix (all transitions allowed/denied).
- **Integration** (`tests/integration/checkout.test.ts`): an isolated SQLite database per suite (`tests/helpers.ts`); cart → order with server repricing, snapshot verification after a DB price flip, idempotent replay proof, stock-reserve races, complete webhook flow (signature forging; duplicate-event idempotency; wrong-amount IGNORED).
- **Security** (`tests/security/`): IDOR tables (owner/stranger/admin/token), guest-order isolation, and the price-manipulation smuggle tests (the ones that ensure dropped fields stay dropped).

`tests/helpers.ts` seeds a minimal catalog through the **same repositories the app uses** — tests exercise real code paths, not fixtures that drift.

## 7. What we deliberately did NOT build

- **Microservices / SaaS checkout orchestrators / Kubernetes:** single-box SQLite + vertical scale handles much more than this shop realistically reaches. （§4, §108 of the spec — boring tech earns its keep.)
- **Client-side payment confirmations:** deliberately replayable — the confirmation page polls the server state instead.
- **FTS:** boutique scale → LIKE-prefix + facets run in milliseconds. An FTS5 migration is sketched here if the catalog exceeds ~5k products.
- **Multi-currency:** `CURRENCY` env anchors one storefront currency at a time; orders snapshot that currency at purchase.
