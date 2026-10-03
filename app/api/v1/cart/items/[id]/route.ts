import { api, ok, parseJson } from '@/lib/http/api'
import { cartUpdateSchema } from '@/lib/validation/schemas'
import { removeLine, setLineQuantity, summarizeCart } from '@/lib/services/cart'
import { assertSameOrigin } from '@/lib/security/guard'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = api(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request)
  const { id } = await ctx.params
  const input = await parseJson(request, cartUpdateSchema)
  const cart = await setLineQuantity(id, input.quantity)
  return ok(summarizeCart(cart))
})

export const DELETE = api(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request)
  const { id } = await ctx.params
  const cart = await removeLine(id)
  return ok(summarizeCart(cart))
})
