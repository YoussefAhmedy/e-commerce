#!/usr/bin/env tsx
/** Dev helper: sign a mock webhook payload like the hosted pay page does. */
import { hmacSha256, newToken } from '../lib/db'

const intentId = process.argv[2]
const orderId = process.argv[3]
const amountCents = Number(process.argv[4])
const type = (process.argv[5] ?? 'PAYMENT_SUCCEEDED') as 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED'

if (!intentId || !orderId || !amountCents) {
  console.error('usage: tsx scripts/sign-mock-webhook.ts <intentId> <orderId> <amountCents> [PAYMENT_SUCCEEDED|PAYMENT_FAILED]')
  process.exit(1)
}

const payload = {
  eventId: `evt_${newToken(12)}`,
  type,
  intentId,
  orderId,
  amountCents,
  currency: 'USD',
}
const body = JSON.stringify(payload)
const secret = process.env.APP_SECRET && process.env.APP_SECRET.length >= 16 ? process.env.APP_SECRET : 'dev-only-secret-change-in-prod'
console.log(JSON.stringify({ body, signature: hmacSha256(secret, body) }))
