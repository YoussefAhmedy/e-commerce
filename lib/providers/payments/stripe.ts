import { env } from '@/lib/config/env'
import { hmacSha256, safeEqual } from '@/lib/domain/ids'
import { AppError } from '@/lib/domain/errors'
import type { CreateIntentInput, PaymentIntentResult, PaymentProvider, VerifiedPaymentEvent } from './types'

/**
 * Stripe provider — raw REST (no SDK weight).
 *
 *  - createIntent → POST /v1/payment_intents (automatic_payment_methods)
 *    → clientSecret returned for Payment Element checkout
 *  - verifyWebhook → verifies the `Stripe-Signature` header (v1 HMAC scheme)
 *    per https://stripe.com/docs/webhooks/signature
 *
 * Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe'
  private readonly api = 'https://api.stripe.com/v1'

  private secret(): string {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError('INTERNAL', 'Stripe is selected but STRIPE_SECRET_KEY is not configured.')
    }
    return env.STRIPE_SECRET_KEY
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentResult> {
    const body = new URLSearchParams({
      amount: String(input.amountCents),
      currency: input.currency.toLowerCase(),
      'metadata[orderId]': input.orderId,
      'metadata[orderNumber]': input.orderNumber,
      description: input.description,
      'automatic_payment_methods[enabled]': 'true',
      // Idempotent retries at the provider level too:
    })
    const res = await fetch(`${this.api}/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `order-${input.orderId}`,
      },
      body,
    })
    const json = (await res.json()) as { id?: string; client_secret?: string; error?: { message?: string } }
    if (!res.ok || !json.id || !json.client_secret) {
      throw new AppError('PAYMENT_FAILED', `Stripe error: ${json.error?.message ?? res.status}`)
    }
    return { intentId: json.id, checkoutUrl: null, clientSecret: json.client_secret }
  }

  verifyWebhook(rawBody: string, headers: Headers): VerifiedPaymentEvent {
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) throw new AppError('INTERNAL', 'STRIPE_WEBHOOK_SECRET is not configured.')
    const header = headers.get('stripe-signature')
    if (!header) throw new AppError('FORBIDDEN', 'Missing Stripe-Signature header.')

    const parts = Object.fromEntries(
      header.split(',').map((kv) => kv.split('=') as [string, string]),
    )
    const timestamp = parts['t']
    const signature = parts['v1']
    if (!timestamp || !signature) throw new AppError('FORBIDDEN', 'Malformed Stripe signature.')

    const expected = hmacSha256(webhookSecret, `${timestamp}.${rawBody}`)
    if (!safeEqual(expected, signature)) throw new AppError('FORBIDDEN', 'Invalid Stripe signature.')
    // 5-minute replay tolerance
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      throw new AppError('FORBIDDEN', 'Stripe webhook timestamp out of tolerance.')
    }

    const event = JSON.parse(rawBody) as {
      id: string
      type: string
      data: { object: { id: string; amount?: number; currency?: string; metadata?: Record<string, string> } }
    }
    const object = event.data.object
    const orderId = object.metadata?.orderId
    if (!orderId) throw new AppError('VALIDATION', 'Stripe event missing order metadata.')

    if (event.type === 'payment_intent.succeeded') {
      return {
        eventId: event.id,
        type: 'PAYMENT_SUCCEEDED',
        intentId: object.id,
        orderId,
        amountCents: object.amount ?? 0,
        currency: (object.currency ?? 'USD').toUpperCase(),
      }
    }
    if (event.type === 'payment_intent.payment_failed') {
      return {
        eventId: event.id,
        type: 'PAYMENT_FAILED',
        intentId: object.id,
        orderId,
        amountCents: object.amount ?? 0,
        currency: (object.currency ?? 'USD').toUpperCase(),
      }
    }
    throw new AppError('VALIDATION', `Unhandled Stripe event type ${event.type}`)
  }

  async refund(intentId: string): Promise<void> {
    const res = await fetch(`${this.api}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ payment_intent: intentId }),
    })
    if (!res.ok) throw new AppError('PAYMENT_FAILED', 'Stripe refund failed; see provider dashboard.')
  }
}
