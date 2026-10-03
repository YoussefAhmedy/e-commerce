import crypto from 'node:crypto'
import { env } from '@/lib/config/env'
import { hmacSha256, safeEqual } from '@/lib/domain/ids'
import { AppError } from '@/lib/domain/errors'
import type { CreateIntentInput, PaymentIntentResult, PaymentProvider, VerifiedPaymentEvent } from './types'

/**
 * Mock provider for local development & CI.
 *
 * It mirrors the production flow faithfully:
 *   checkout → hosted pay page (/checkout/pay/[intent]) → server-signed
 *   event → POST /api/webhooks/payments/mock → HMAC verification →
 *   idempotent fulfillment.
 *
 * The signing secret (APP_SECRET) lives only on the server; the hosted pay
 * page embeds payload+signature in the form (they are the webhook body),
 * exactly like a real gateway redirects/posts signed callbacks.
 */

interface MockPayload {
  eventId: string
  type: 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED'
  intentId: string
  orderId: string
  amountCents: number
  currency: string
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock'

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentResult> {
    const intentId = `mock_${crypto.randomUUID()}`
    return {
      intentId,
      checkoutUrl: `/checkout/pay/${intentId}`,
      clientSecret: null,
    }
  }

  /** Sign an event payload the way the hosted page/CLI does (tests reuse this). */
  static sign(payload: MockPayload): string {
    return hmacSha256(env.APP_SECRET, JSON.stringify(payload))
  }

  verifyWebhook(rawBody: string, headers: Headers): VerifiedPaymentEvent {
    const signature = headers.get('x-pq-signature')
    if (!signature) throw new AppError('FORBIDDEN', 'Missing webhook signature.')
    const expected = hmacSha256(env.APP_SECRET, rawBody)
    if (!safeEqual(signature, expected)) {
      throw new AppError('FORBIDDEN', 'Invalid webhook signature.')
    }
    let payload: MockPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      throw new AppError('VALIDATION', 'Malformed webhook payload.')
    }
    if (!payload.eventId || !payload.orderId || !payload.intentId || !payload.type) {
      throw new AppError('VALIDATION', 'Webhook payload is missing required fields.')
    }
    if (payload.type !== 'PAYMENT_SUCCEEDED' && payload.type !== 'PAYMENT_FAILED') {
      throw new AppError('VALIDATION', 'Unknown webhook event type.')
    }
    return payload
  }
}
