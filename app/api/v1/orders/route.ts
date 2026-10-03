import { api, ok, parseJson } from '@/lib/http/api'
import { orderCreateSchema } from '@/lib/validation/schemas'
import { resolveCart } from '@/lib/services/cart'
import { createOrderFromCart, initiatePayment, orderAccessToken } from '@/lib/services/orders'
import { assertSameOrigin, requireUser, userIp } from '@/lib/security/guard'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/domain/errors'
import { getSessionUser } from '@/lib/security/session'
import { listOrdersByUser } from '@/lib/db/repositories/orders'

/** Order history for the signed-in customer. */
export const GET = api(async () => {
  const user = await requireUser()
  return ok({ orders: listOrdersByUser(user.id) })
})

/**
 * POST /api/v1/orders — the checkout commit.
 * Re-prices everything server-side, reserves stock transactionally,
 * then (for non-replays) creates the payment intent with the provider.
 * Idempotent: retries with the same key return the original order + session.
 */
export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await getSessionUser()
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`order:${user?.id ?? ip}`, 20, 3600)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many checkout attempts — try again later.')

  const input = await parseJson(request, orderCreateSchema)
  if (!user && !input.email) throw new AppError('VALIDATION', 'Guest checkout requires an email address.')

  const { cart } = await resolveCart()
  const { order, isReplay } = createOrderFromCart(cart, user, {
    idempotencyKey: input.idempotencyKey,
    email: input.email ?? null,
    shippingAddress: input.shippingAddress,
    ...(input.couponCode ? { couponCode: input.couponCode } : {}),
  })

  // Payment session for fresh orders; replays just recover the order.
  const payment = isReplay ? null : await initiatePayment(order)

  return ok(
    {
      order,
      payment,
      accessToken: orderAccessToken(order.id),
      isReplay,
    },
    { status: isReplay ? 200 : 201 },
  )
})
