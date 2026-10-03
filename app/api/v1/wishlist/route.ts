import { api, ok, parseJson } from '@/lib/http/api'
import { wishlistToggleSchema } from '@/lib/validation/schemas'
import { requireUser, assertSameOrigin } from '@/lib/security/guard'
import { toggleWishlist } from '@/lib/services/engagement'
import { listWishlistProductIds } from '@/lib/db/repositories/engagement'

export const GET = api(async () => {
  const user = await requireUser()
  return ok({ productIds: listWishlistProductIds(user.id) })
})

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const { productId } = await parseJson(request, wishlistToggleSchema)
  const result = toggleWishlist(user, productId)
  return ok({ ...result, productIds: listWishlistProductIds(user.id) })
})
