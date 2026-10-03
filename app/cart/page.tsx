import type { Metadata } from 'next'
import { resolveCart, summarizeCart } from '@/lib/services/cart'
import { getSessionUser } from '@/lib/security/session'
import { CartView } from './cart-view'

export const metadata: Metadata = {
  title: 'Your cart',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const user = await getSessionUser()
  const { cart } = await resolveCart()
  const summary = summarizeCart(cart, sp.coupon, user?.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <CartView initial={summary} couponQuery={sp.coupon ?? ''} />
    </div>
  )
}
