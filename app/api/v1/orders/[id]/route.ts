import { api, ok } from '@/lib/http/api'
import { getOrderById } from '@/lib/db/repositories/orders'
import { canViewOrder } from '@/lib/services/orders'
import { getSessionUser } from '@/lib/security/session'
import { AppError } from '@/lib/domain/errors'

/** Fetch one order — owner, admin, or holder of the signed guest access token. */
export const GET = api(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params
  const order = getOrderById(id)
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.')

  const user = await getSessionUser()
  const accessToken = new URL(request.url).searchParams.get('k')
  if (!canViewOrder(order, user, accessToken)) {
    throw new AppError('FORBIDDEN', 'You don’t have access to this order.')
  }
  return ok({ order })
})
