import { api, ok, parseJson } from '@/lib/http/api'
import { couponValidateSchema } from '@/lib/validation/schemas'
import { resolveCart, summarizeCart } from '@/lib/services/cart'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/domain/errors'
import { getSessionUser } from '@/lib/security/session'
import { findCouponByCode, countCouponRedemptions } from '@/lib/db/repositories/orders'
import { checkCoupon, normalizeCode } from '@/lib/domain/coupons'

/**
 * Coupon pre-validation for the cart UI. The same checks run again,
 * authoritatively, inside the order-creation transaction.
 */
export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`coupon:${ip}`, 30, 900)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many coupon attempts.')

  const { code } = await parseJson(request, couponValidateSchema)
  const user = await getSessionUser()
  const { cart } = await resolveCart()

  const candidate = findCouponByCode(normalizeCode(code))
  const subtotal = cart.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)
  const counts = candidate ? countCouponRedemptions(candidate.id, user?.id ?? null) : { total: 0, byUser: 0 }
  const check = checkCoupon(candidate, {
    subtotalCents: subtotal,
    userId: user?.id ?? null,
    userRedemptions: counts.byUser,
    totalRedemptions: counts.total,
    now: new Date(),
  })
  if (!check.ok) throw new AppError('COUPON_INVALID', check.message)

  return ok({ summary: summarizeCart(cart, code, user?.id) })
})
