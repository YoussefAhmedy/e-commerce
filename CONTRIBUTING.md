# Contributing

## Setup — 5 minutes

```bash
npm ci
cp .env.example .env.local
npm run db:seed
npm run dev        # → http://localhost:3000
```

Test credentials live in the README. Seeding is idempotent; `npm run db:reset` starts over.

## Ground rules — the commerce laws

The money and security surfaces are the reason this project exists; they are non-negotiable.

1. **Never trust the client.** Prices, totals, coupons, inventory, payment states, and order-access decisions are computed server-side from DB truth. Client payloads hold ids and quantities only.
  - New checkout-adjacent code? It must fail tests under the "price manipulation" security suite — write a negative test with it.
2. **Money is integer cents.** Compute in `lib/domain/pricing.ts`. No floats; totals derive (`computeTotals`), never multiply tax on top of discount in the wrong order.
3. **Money movement and inventory are transactional.** Use `withTransaction`, respect the order FSM (`lib/domain/order-fsm.ts`), and never bypass `(order, action)` pairs with ad-hoc SQL updates.
4. **New dangerous inputs → new boundary validation.** Zod schemas in `lib/validation/schemas.ts` parse everything that crosses the network.
5. **Authorization is server-side everywhere.** Every admin page *and* every admin server action must call `requireAdmin()` (layout guards alone are cosmetic).
6. **No secrets in code.** New config lands in `lib/config/env.ts` + `.env.example`. `npm run build` must pass with only `.env.example` values.
7. **AI never invents facts.** Assistant features must read from the DB; model text is a presentation layer, not a data source. If an AI response would otherwise contain prices/stock/policies, you did it wrong.

## Code conventions

- **Layers:** `app/` (HTTP + render) → `lib/services/` (use cases, transactions) → `lib/db/repositories/` (the only SQL authors) → `lib/domain/` (pure logic). Dependencies point inward — no page imports repositories (leads to bypassed invariants).
- Minimal, meaningful exports. No abstraction without a second concrete case.
- UI: Tailwind tokens (`ink`, `clay`, `cream`, `paper`, `forest`, `line`) map to `app/globals.css` (`@theme`). Accessible-first: semantic HTML, focus rings, keyboard support, `aria-*` where interactive.
- Components: server by default; `'use client'` only for interactivity.

## What "done" means

CI is the arbiter, plus a manual pass:

```bash
npm run typecheck
npm run lint
npm test
npm run build        # must complete clean
```

Open your PR with:
- **What & why** (the user-facing behavior change);
- **Verification** — CI green boxes checked, screenshots for UI;
- a mention of any new env vars (documented in `.env.example`) and any provider/infra implications in [docs/deployment.md](docs/deployment.md).

Small focused PRs merge fast; sweeping ones get reviewed hard.

## Style

- Formatters: none enforced — write clean TypeScript that `npm run lint` approves, with calmly descriptive names.
- Comments explain **why**, not what; depth-guarded invariants get doccomments.
- Conventional commit subjects are welcome but not enforced.

## Reporting security issues

Not here — see [SECURITY.md](SECURITY.md).
