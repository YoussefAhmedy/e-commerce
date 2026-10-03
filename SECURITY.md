# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Please report privately via **GitHub Security Advisories** (`Security` tab → *Report a vulnerability*), or by emailing **security@printique.example**. Include reproduction steps, affected routes/versions, and impact — we triage every report.

**Response targets:** acknowledgment within 72h; verified fix or mitigation within 14 days; public advisory after a patched release.

## Supported versions

| Version | Supported |
| ------- | --------- |
| Current `main` and the latest release tag | ✅ |
| Older tags | ❌ — please upgrade |

## Scope notes

This app is self-hosted and intentionally ships with sensible, conservative defaults (mock payment provider, console email, no AI key). Security-relevant behavior worth reviewing:

- All money math is server-side; `paymentSuccess`/`clientTotal*` fields are ignored by design.
- Webhook authenticity is HMAC-signed (`APP_SECRET`) with per-event idempotency.
- Admin surfaces verify the `ADMIN` role server-side — layout navigation is cosmetic, never the boundary.
- Rate limiting exists on auth, checkout, assistant, and upload endpoints (in-memory);
  put app-level or edge rate limiting (CDN/WAF) in front for production.

## Hardening checklist for production operators

- [ ] Set a strong random `APP_SECRET` (32+ bytes hex).
- [ ] `PAYMENT_PROVIDER=stripe` with live `STRIPE_WEBHOOK_SECRET` pointing at your stripe dashboard.
- [ ] `EMAIL_PROVIDER=smtp` with TLS-enabled SMTP creds.
- [ ] Serve behind TLS with HSTS (the app only sets it in `production`).
- [ ] Rotate any value that ever appeared in a non-private place (the refund/coupon audit log writes values, never secrets).
- [ ] Volumes: protect the `DATA_DIR` (database + uploads) with host-level permissions/backups.
