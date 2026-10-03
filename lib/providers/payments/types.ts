/**
 * Payment provider abstraction.
 *
 * IPaymentProvider
 *   ├── MockPaymentProvider   — local development; HMAC-signed webhooks,
 *   │                           exercises the identical webhook/idempotency path as production
 *   └── StripeProvider        — real Stripe API + Stripe-Signature verification
 *
 * Rule #1 of payments here: the browser NEVER confirms payment.
 * Only a verified webhook/callback can move an order to PAID.
 */

export interface CreateIntentInput {
  orderId: string
  orderNumber: string
  amountCents: number
  currency: string
  description: string
  returnUrl: string
}

export interface PaymentIntentResult {
  intentId: string
  /** Hosted checkout/pay URL when the provider has one (mock, Stripe Payment Links). */
  checkoutUrl: string | null
  /** Client secret for embedded elements (Stripe PaymentIntent). */
  clientSecret: string | null
}

export type PaymentEventType = 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED'

export interface VerifiedPaymentEvent {
  /** Provider-unique event id — the idempotency key. */
  eventId: string
  type: PaymentEventType
  intentId: string
  orderId: string
  amountCents: number
  currency: string
}

export interface PaymentProvider {
  readonly name: string
  createIntent(input: CreateIntentInput): Promise<PaymentIntentResult>
  /**
   * Verify + normalize an inbound webhook. MUST authenticate the request
   * (signature/HMAC) and throw FORBIDDEN on failure. Receives the RAW body —
   * signature verification requires the exact bytes.
   */
  verifyWebhook(rawBody: string, headers: Headers): VerifiedPaymentEvent
  refund?(intentId: string, amountCents: number): Promise<void>
}
