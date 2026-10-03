import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { resolveCart, summarizeCart } from '@/lib/services/cart'
import { getSessionUser } from '@/lib/security/session'
import { listAddresses } from '@/lib/db/repositories/users'
import { CheckoutClient } from './checkout-client'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const user = await getSessionUser()
  const { cart } = await resolveCart()
  if (cart.lines.length === 0) redirect('/cart')

  const summary = summarizeCart(cart, sp.coupon, user?.id)
  const addresses = user ? listAddresses(user.id) : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CheckoutClient
        initialSummary={summary}
        initialEmail={user?.email ?? ''}
        initialAddress={
          addresses.find((a) => a.isDefault) ?? addresses[0] ?? null
        }
        isAuthenticated={Boolean(user)}
      />
    </div>
  )
}
