<div align="center">

# 🖼️ Printique

**Art prints & custom framing studio** — a production-grade 2026 e-commerce application.

Curated poster catalog · custom photo upload → size → frame → review studio ·
server-side cart & checkout · order lifecycle FSM · signed payment webhooks ·
AI shopping assistant · full admin studio.

[Stack](#-stack) · [Quickstart](#-quickstart) · [Architecture](docs/architecture.md) · [Security](SECURITY.md) · [Deployment](docs/deployment.md) · [Contributing](CONTRIBUTING.md)

[![CI](https://github.com/OWNER-SET-ME/printique/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER-SET-ME/printique/actions/workflows/ci.yml)
[![License: MIT](LICENSE)](https://img.shields.io/badge/license-MIT-clay)

</div>

---

## ✨ Features

### Storefront
- **Boutique catalog** — data-driven product catalog with multi-term search, category/type/color/material/size/price facets, sort, and pagination.
- **Custom studio** — photograph upload (validated server-side for type/size/dimensions), print-size selection, live frame preview, review step. Prices always resolve from server data (`variantId`s + `uploadId`), never client input.
- **Cart & checkout** — server-hydrated cart for guests and members (auto-merge at sign-in), coupons (server-validated, per-user limits, audit), guest checkout with HMAC-signed order access tokens, idempotent order creation (retries return the original order).
- **Payments** — provider abstraction with mock provider for dev and Stripe for production; **all payment success is verified server-side via signed webhooks** with idempotent event processing, amount/currency cross-checks and FSM-guarded transitions. The UI's "paymentSuccess" flag is deliberately ignored.
- **Commerce suite** — wishlists, verified-purchase reviews with moderation, order tracking, address book, notifications.

### AI — real, grounded, honest
- **Shopping assistant** (`/search`) — natural-language catalog search executed against backend truth. It sees only published products and never invents prices, stock, discounts, or policies; tool-call arguments are product names only. No AI key? A deterministic offline mode composes from real catalog data with an explicit "template mode" label.
- **Admin content copilot** (`/admin/ai-tools`) — drafts product descriptions, SEO metadata, and tags from structured product attributes. Output is an editable draft; nothing auto-publishes.
- **Prompt-injection hardened** — user text never becomes an instruction the model couldn't have issued by itself; catalog search runs server-side regardless of what a user asks for.

### Admin studio
- Dashboard (revenue, AOV, units, conversion, 30-day revenue chart, top products).
- Products & categories CRUD with draft/publish/archive lifecycle.
- Orders with FSM buttons (start processing → ship w/ tracking → deliver), cancel/refund with audit reasons.
- Coupons CRUD (percent/fixed, date windows, redemption + per-user caps).
- Customers (read-only read-model), reviews moderation queue.
- Inventory via low-stock dashboard indicators & variant-level stock with reservations.
- **Audit log** of every security-relevant event.

### Engineering security
Bcrypt passwords (cost 12), timing-safe comparisons, locked-out-after-5-attempts sign-in, uniform-response password reset, email verification, server-side role authorization on every admin page _and_ every admin server action, IDOR-proof order access, Zod validation on every boundary, rate limiting on sensitive endpoints, CSP + security headers, structured logging with request IDs, liveness/readiness health checks, audit logging.

Negative-test suite covers: smuggled `clientTotalCents`/`paymentSuccess`, forged webhook signatures, wrong-amount webhooks, cross-customer IDOR, oversell races, and coupon-limit bypass attempts.

## 🧱 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | **Node 24 LTS** | LTS; native `node:sqlite` is stable |
| Framework | **Next.js 16 (App Router, Turbopack)** | Current major; RSC-first, streaming |
| Language | **TypeScript 5.9 (strict)** | End-to-end type safety |
| UI | **React 19, Tailwind CSS 4** | Modern primitives, design-token theming |
| Database | **SQLite via `node:sqlite`** (WAL) | Zero-infrastructure, real ACID; thin repository seam keeps a Postgres swap local |
| Auth | Cookie sessions (httpOnly) + bcrypt | No vendor lock-in, auditable |
| Validation | **Zod 4** on every input boundary | Parses once, mistakes die there |
| Payments | abstraction → Stripe (or embedded mock) | Provider-agnostic, server-verified |
| Email | abstraction → SMTP/nodemailer (or console) | Same API dev→prod |
| AI | OpenAI-compatible chat (or offline fallback) | Grounded responses; no second provider needed |
| Testing | **Vitest** (unit + integration + security) | Fast, native ESM |
| Deploy | **Multi-stage Dockerfile, non-root**, docker-compose for dev | No secrets baked in; sqlite volume |

## 🚀 Quickstart

Requires Node 24+ (see `.nvmrc`) and npm 10+.

```bash
npm ci                        # install
cp .env.example .env.local    # edit values (defaults all work for dev)
npm run db:seed               # create the dev database with realistic data
npm run dev                   # → http://localhost:3000

# Database already seeded? `npm run db:seed` is idempotent — it reports and exits.
```

| Account | Email | Password |
| --- | --- | --- |
| Admin | `admin@printique.test` | `Printique!2026` |
| Customer | `demo@printique.test` | `Printique!2026` |

Coupon `WELCOME10` (10% off) is live for fresh accounts.

## ✅ Everyday commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint flat config
npm test            # Vitest: unit + integration + security suites
npm run build       # production build (standalone Node server)
npm start           # serve the production build
npm run db:seed     # seed dev data (idempotent)
npm run db:reset    # wipe dev db (escape hatch)
```

## 🐳 Docker

```bash
docker build -t printique .
docker run -p 3000:3000 \
  -v printique-data:/data \
  -e APP_SECRET="$(openssl rand -hex 32)" \
  printique
# or: docker compose up --build
```

The image contains **no database and no secrets** — migrations run at boot, `DATA_DIR` lives on the `/data` volume, and every sensitive value is runtime env. See [docs/deployment.md](docs/deployment.md) for platforms (Render, Fly, a VPS, K8s) and external config checklists (Stripe, SMTP, AI, DNS).

## 📚 Docs

- [docs/architecture.md](docs/architecture.md) — layered structure, commerce flows, design decisions.
- [docs/security.md](docs/security.md) — threat model and control checklist.
- [docs/deployment.md](docs/deployment.md) — run anywhere; external integrations.
- [SECURITY.md](SECURITY.md) — reporting a vulnerability.
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, conventions, PR contract.

## 🗺 Roadmap

Validates the commerce core; deliberate non-goals are documented in the architecture doc:

- Postgres adapter via the existing repository seam (schema is SQL-portable).
- Stripe Connect payouts for multi-vendor framing studios (needs entity model).
- Server-rendered order PDF receipts (provider seam exists).
- Content-region sales tax & shipping table (env-level config today is intentionally simple).

## License

MIT — see [LICENSE](LICENSE).
