import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrderByNumber } from '@/lib/db/repositories/orders'
import { canViewOrder } from '@/lib/services/orders'
import { getSessionUser } from '@/lib/security/session'
import { env } from '@/lib/config/env'
import { ConfirmationView } from './confirmation-view'

export const metadata: Metadata = {
  title: 'Order confirmation',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type Ctx = {
  params: Promise<{ number: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function OrderConfirmationPage({ params, searchParams }: Ctx) {
  const { number } = await params
  const sp = await searchParams
  const order = getOrderByNumber(number)
  if (!order) notFound()

  const user = await getSessionUser()
  if (!canViewOrder(order, user, sp.k ?? null)) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <ConfirmationView
        order={order}
        accessToken={sp.k ?? ''}
        payment={sp.payment ?? ''}
        mockProviderEnabled={env.PAYMENT_PROVIDER === 'mock'}
        awaiting={sp.awaiting ?? ''}
      />
      <div className="mt-10 flex justify-center gap-3">
        <Link href={'/catalog' as never} className="btn-primary">
          Continue shopping
        </Link>
        {user ? (
          <Link href={'/account/orders' as never} className="btn-secondary">
            View my orders
          </Link>
        ) : (
          <p className="max-w-[16rem] self-center text-center text-xs text-ink-faint">
            Tip: create an account to track this order any time.
          </p>
        )}
      </div>
    </div>
  )
}
