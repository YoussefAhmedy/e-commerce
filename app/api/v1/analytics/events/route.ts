import { api, ok, parseJson } from '@/lib/http/api'
import { analyticsEventSchema } from '@/lib/validation/schemas'
import { trackEvent } from '@/lib/db/repositories/engagement'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'
import { getSessionUser } from '@/lib/security/session'

/**
 * First-party product analytics (views, add-to-cart, searches).
 * Purpose-bound: powers "trending" and admin merchandising. No PII in meta.
 */
export const POST = api(async (request: Request) => {
  const limit = checkRateLimit(`analytics:${userIp(request) ?? 'unknown'}`, 120, 60)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many events.')

  const input = await parseJson(request, analyticsEventSchema)
  const user = await getSessionUser()
  trackEvent(input.type, {
    productId: input.productId,
    userId: user?.id,
    meta: input.meta,
  })
  return ok({ tracked: true }, { status: 202 })
})
