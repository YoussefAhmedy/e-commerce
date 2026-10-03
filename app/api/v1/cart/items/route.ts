import { api, ok, parseJson } from '@/lib/http/api'
import { cartAddSchema } from '@/lib/validation/schemas'
import { addLine, persistCartCookie, summarizeCart } from '@/lib/services/cart'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/domain/errors'

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const limit = checkRateLimit(`cart:${userIp(request) ?? 'unknown'}`, 120, 60)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many cart operations — slow down.')

  const input = await parseJson(request, cartAddSchema)
  const { cart, freshToken } = await addLine({
    variantId: input.variantId,
    quantity: input.quantity,
    customization: input.customization ?? null,
  })
  await persistCartCookie(freshToken)
  return ok(summarizeCart(cart), { status: 201 })
})
