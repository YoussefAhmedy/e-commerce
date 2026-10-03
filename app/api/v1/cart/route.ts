import { api, ok } from '@/lib/http/api'
import { resolveCart, summarizeCart, persistCartCookie } from '@/lib/services/cart'
import { getSessionUser } from '@/lib/security/session'

/** The cart API always returns server-priced lines + totals. */
export const GET = api(async (request: Request) => {
  const user = await getSessionUser()
  const { cart, freshToken } = await resolveCart()
  await persistCartCookie(freshToken)
  const coupon = new URL(request.url).searchParams.get('coupon')
  const summary = summarizeCart(cart, coupon, user?.id)
  return ok(summary)
})
