import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import crypto from 'node:crypto'
import { findPaymentByIntent, getOrderById } from '@/lib/db/repositories/orders'
import { MockPaymentProvider } from '@/lib/providers/payments/mock'
import { orderAccessToken } from '@/lib/services/orders'
import { env } from '@/lib/config/env'
import { PayForm } from './pay-form'

export const metadata: Metadata = {
  title: 'Secure payment',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

/**
 * Dev/preview hosted payment page (PAYMENT_PROVIDER=mock).
 * It mimics a real gateway: the form posts a provider-signed event to the
 * webhook endpoint; ONLY the webhook can mark the order paid.
 */
export default async function HostedPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ intent: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  if (env.PAYMENT_PROVIDER !== 'mock') notFound()

  const { intent } = await params
  const sp = await searchParams
  const payment = findPaymentByIntent(intent)
  if (!payment) notFound()

  const order = getOrderById(payment.orderId)
  if (!order) notFound()
  const accessToken = sp.k && sp.k === orderAccessToken(order.id) ? sp.k : orderAccessToken(order.id)

  // Already settled? Skip the cashier entirely.
  if (order.paymentStatus === 'PAID') {
    redirect(`/order-confirmation/${order.number}?k=${accessToken}`)
  }

  const base = {
    intentId: intent,
    orderId: order.id,
    amountCents: order.totalCents,
    currency: order.currency,
  }
  const successPayload = { ...base, eventId: crypto.randomUUID(), type: 'PAYMENT_SUCCEEDED' as const }
  const failurePayload = { ...base, eventId: crypto.randomUUID(), type: 'PAYMENT_FAILED' as const }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="card w-full p-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-faint">
          Printique Payments · sandbox
        </p>
        <h1 className="mt-3 text-center font-display text-2xl font-semibold">
          Complete your payment
        </h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Order {order.number}
        </p>
        <PayForm
          intent={intent}
          amountCents={order.totalCents}
          currency={order.currency}
          orderNumber={order.number}
          accessToken={accessToken}
          successPayload={JSON.stringify(successPayload)}
          successSignature={MockPaymentProvider.sign(successPayload)}
          failurePayload={JSON.stringify(failurePayload)}
          failureSignature={MockPaymentProvider.sign(failurePayload)}
        />
        <p className="mt-5 text-center text-xs leading-relaxed text-ink-faint">
          This is the local sandbox provider. It posts a HMAC-signed webhook through
          the exact same pipeline the Stripe provider uses in production.
        </p>
      </div>
    </div>
  )
}
