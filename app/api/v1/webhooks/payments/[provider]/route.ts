import { api, ok } from '@/lib/http/api'
import { handlePaymentWebhook } from '@/lib/services/orders'
import { log } from '@/lib/observability/logger'

/**
 * Payment webhooks — RAW body required for signature verification.
 * Idempotent by design: duplicate deliveries → { status: 'duplicate' }.
 * Note: no CSRF origin check here; authenticity comes from the signature.
 */
export const POST = api(async (request: Request, ctx: { params: Promise<{ provider: string }> }) => {
  const { provider } = await ctx.params
  const rawBody = await request.text()
  const result = await handlePaymentWebhook(provider, rawBody, request.headers)
  log.info('payment webhook handled', {
    provider,
    type: result.event.type,
    status: result.status,
  })
  return ok(result)
})

/** Gateways occasionally probe the endpoint with GET. */
export const GET = api(async () => ok({ listening: true }))
