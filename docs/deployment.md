# Deployment

Printique is a self-contained Node 24 app. Ship the Docker image anywhere that runs containers + east-west TLS. No external services are required, but real payments/email/AI add optional configuration below.

## 1. Runtime

```bash
docker build -t printique .
docker run -p 3000:3000 \
  -v printique-data:/data \
  -e APP_SECRET="$(openssl rand -hex 32)" \
  printique
```

The image is Alpine + node (non-root user `app`), ~160MB. `DATA_DIR=/data` holds the SQLite database + uploaded media — **back up that volume**.

- Migrations run automatically at boot (`instrumentation.ts`). Boot order is therefore `migrate → start email worker → serve`.
- Health checks: `GET /api/health` (liveness) and `GET /api/health/ready` (database reachable). The Dockerfile's HEALTHCHECK already wires liveness.
- Logs are JSON-structured to stdout with `x-request-id` correlation; ship them to your platform's log drain.

## 2. Platforms

| Platform | Notes |
|---|---|
| **Render / Railway / Fly.io** | Create a web service from the repo; attach a persistent volume at `/data`; point `SITE_URL` at your hostname. Migrations need no extra command. |
| **VPS / EC2** | Run the image with `--restart unless-stopped`, Caddy/nginx in front for TLS. Set `NODE_ENV=production` so HSTS + tightened CSP emit. |
| **Kubernetes** | Works as a single replica behind any ingress; SQLite is single-writer — set `strategy: Recreate` and mount one PV. Scaling horizontally implies the Postgres swap (see architecture doc §1). |
| **Docker Compose (dev)** | `docker compose up --build` ships an equivalent setup on port 3000 with a named volume. |

## 3. Environment reference

All keys are validated at boot in `lib/config/env.ts` (startup fails fast on bad input — check container logs).

| Variable | Default | Purpose |
|---|---|---|
| `SITE_URL` | `http://localhost:3000` | Canonical origin in metadata/emails |
| `DATA_DIR` | `.data` | SQLite + uploads directory (mount a volume) |
| `APP_SECRET` | dev value | **Required in prod**; HMACs webhooks and order tokens |
| `PAYMENT_PROVIDER` | `mock` | `mock` or `stripe` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | – | Required when `PAYMENT_PROVIDER=stripe` |
| `EMAIL_PROVIDER` | `console` | `console` (log) or `smtp` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | – | SMTP sending |
| `AI_PROVIDER` | `none` | `none` (offline mode) or `openai-compatible` |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | `$base=OpenAI/chat` | Any OpenAI-compatible chat endpoint |
| `AI_RATE_LIMIT` | 30 | Assistant requests/IP/hour |
| `TAX_RATE` | 0.08 | Sales tax fraction |
| `SHIPPING_FLAT_CENTS` / `FREE_SHIPPING_THRESHOLD_CENTS` | 999 / 10000 | Flat shipping + free-shipping threshold |

**Do not** commit values to git. `.env.example` is the only file allowed to contain them.

## 4. Setting up the integrations

### Stripe (payments)
1. Create a new restricted key with `payment_intents` write + `webhook_endpoints` write (or sign in Stripe dashboard directly).
2. In Stripe dashboard: create webhook endpoint pointing at `https://YOUR_DOMAIN/api/v1/webhooks/payments/stripe` with `payment_intent.succeeded` + `payment_intent.payment_failed` events; copy the signing secret.
3. Env: set provider and both secrets; redeploy. Test with Stripe CLI forwarding before going live: `stripe listen --forward-to localhost:3000/api/v1/webhooks/payments/stripe` and run `stripe trigger payment_intent.succeeded` — watch the audit log for `PAYMENT_SUCCEEDED` / `PAYMENT_AMOUNT_MISMATCH`.

### SMTP (email)
- `EMAIL_PROVIDER=smtp` requires a reachable `SMTP_HOST` and credentials. Test send: sign up a test account → the verify-email message lands in your mailbox instead of the console log. Ports: 587 (STARTTLS) / 465 (implicit TLS).

### AI (assistant + admin drafts)
- Any OpenAI-compatible endpoint works (OpenAI, OpenRouter, Groq, a local `llama.cpp` server with `chat/completions`). Set `AI_PROVIDER=openai-compatible` plus the three AI vars. Templates mode stays as fallback should the provider 429/5xx at runtime.

## 5. Backups & upgrades

- **Backups:** every 5-60 minutes snapshot the `/data` volume (host cron → `tar`. The DB is WAL; either `sqlite3 printique.db '.backup file'` or copy `printique.db-wal` together with `printique.db`).
- **Upgrades:** `docker compose pull && docker compose up -d` (or platform redeploy) runs migrations idempotently — schema changes are additive and named after ISO dates.

## 6. Post-launch verification — the 5-minute smoke test

1. `curl -sf https://YOUR_DOMAIN/api/health` → `200`.
2. Open `/` in a browser — the header should show `content-security-policy: ...default-src 'self'...`.
3. Add an item to the cart, apply `WELCOME10`, and confirm order summary recalculates discount.
4. Sign in as the seeded admin (change the password immediately!), visit `/admin` — dashboard loads with a revenue figure.
5. Place a **mock provider test order**; watch the admin order transition to `CONFIRMED`; see `PAYMENT_SUCCEEDED` in the audit log.
6. Toggle to the real `AI_PROVIDER` and ask the assistant something the catalog can't answer — it should politely say so without inventing alternatives.
