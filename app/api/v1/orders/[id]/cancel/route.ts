import { api, ok } from '@/lib/http/api'
import { cancelOwnOrder } from '@/lib/services/orders'
import { assertSameOrigin, requireUser } from '@/lib/security/guard'

export const POST = api(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const { id } = await ctx.params
  const order = cancelOwnOrder(id, user)
  return ok({ order })
})
