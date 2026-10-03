import { AppError } from '@/lib/domain/errors'
import * as engagement from '@/lib/db/repositories/engagement'
import * as ordersRepo from '@/lib/db/repositories/orders'
import { getProductById } from '@/lib/db/repositories/products'
import { canTransition } from '@/lib/domain/order-fsm'
import type { PublicUser, Review } from '@/lib/db/types'

/** Reviews + wishlist business rules. */

export function submitReview(
  user: PublicUser,
  productId: string,
  input: { rating: number; title: string; body: string },
): { review: 'CREATED' | 'DUPLICATE'; status: Review['status'] } {
  const product = getProductById(productId)
  if (!product || product.status !== 'PUBLISHED') throw new AppError('NOT_FOUND', 'Product not found.')

  const verifiedPurchase = ordersRepo.userHasPurchasedProduct(user.id, productId)
  // Verified buyers are auto-published; everyone else goes to moderation.
  const result = engagement.createReview({
    productId,
    userId: user.id,
    rating: input.rating,
    title: input.title,
    body: input.body,
    status: verifiedPurchase ? 'APPROVED' : 'PENDING',
    verifiedPurchase,
  })
  return { review: result, status: verifiedPurchase ? 'APPROVED' : 'PENDING' }
}

export function toggleWishlist(user: PublicUser, productId: string): { added: boolean } {
  const product = getProductById(productId)
  if (!product || product.status !== 'PUBLISHED') throw new AppError('NOT_FOUND', 'Product not found.')
  return { added: engagement.toggleWishlist(user.id, productId) }
}

/** Whether the signed-in user can cancel a given order (used by account UI). */
export function canCustomerCancel(order: import('@/lib/db/types').Order): boolean {
  return canTransition(order, 'CANCEL')
}
