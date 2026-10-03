import { api, ok, parseJson } from '@/lib/http/api'
import { listProductReviews } from '@/lib/db/repositories/engagement'
import { getProductBySlug } from '@/lib/db/repositories/products'
import { reviewCreateSchema } from '@/lib/validation/schemas'
import { submitReview } from '@/lib/services/engagement'
import { requireUser, assertSameOrigin, userIp } from '@/lib/security/guard'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/domain/errors'

type Ctx = { params: Promise<{ slug: string }> }

export const GET = api(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params
  const product = getProductBySlug(slug)
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.')
  const reviews = listProductReviews(product.id)
  return ok({ reviews, ratingAvg: product.ratingAvg, ratingCount: product.ratingCount })
})

export const POST = api(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`review:${user.id}:${ip}`, 10, 3600)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Slow down — too many review attempts.')

  const { slug } = await ctx.params
  const product = getProductBySlug(slug)
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.')

  const input = await parseJson(request, reviewCreateSchema)
  const result = submitReview(user, product.id, input)
  if (result.review === 'DUPLICATE') {
    throw new AppError('CONFLICT', 'You have already reviewed this product.')
  }
  return ok(
    {
      message:
        result.status === 'APPROVED'
          ? 'Thanks — your review is live.'
          : 'Thanks — your review was submitted and is awaiting moderation.',
    },
    { status: 201 },
  )
})
