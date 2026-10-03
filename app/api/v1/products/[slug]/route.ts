import { api, ok } from '@/lib/http/api'
import { productDetail } from '@/lib/services/catalog'
import { AppError } from '@/lib/domain/errors'

export const GET = api(async (_request: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params
  const product = productDetail(slug)
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.')
  return ok({ product })
})
