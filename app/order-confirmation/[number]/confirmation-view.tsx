'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, CreditCard, Loader2, Package, Truck, XCircle } from 'lucide-react'
import type { Order } from '@/lib/db/types'
import { formatDate, formatMoney } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/badge'

/**
 * Confirmation view — polls the server while payment is pending
 * (the webhook settles asynchronously), then shows the definitive state.
 */
export function ConfirmationView({
  order: initialOrder,
  accessToken,
  payment,
  mockProviderEnabled,
  awaiting,
}: {
  order: Order
  accessToken: string
  payment: string
  mockProviderEnabled: boolean
  awaiting: string
}) {
  const [order, setOrder] = useState(initialOrder)
  const router = useRouter()

  useEffect(() => {
    if (order.paymentStatus !== 'PENDING') return
    const timer = setInterval(async () => {
      const res = await fetch(`/api/v1/orders/${order.id}?k=${accessToken}`, { cache: 'no-store' })
      const json = await res.json()
      if (json?.ok) {
        setOrder(json.data.order)
        if (json.data.order.paymentStatus !== 'PENDING') clearInterval(timer)
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [order.id, order.paymentStatus, accessToken])

  const paid = order.paymentStatus === 'PAID'
  const failed = order.paymentStatus === 'FAILED' || payment === 'failed'

  return (
    <div>
      {/* Status hero */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-soft">
          {paid ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-500/15 text-forest-600">
              <CheckCircle2 size={30} aria-hidden />
            </span>
          ) : failed ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-600">
              <XCircle size={30} aria-hidden />
            </span>
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-50 text-clay-600">
              <Loader2 size={28} className="animate-spin" aria-hidden />
            </span>
          )}
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {paid
            ? 'Thank you — order confirmed!'
            : failed
              ? 'Payment didn’t go through'
              : 'Confirming your payment…'}
        </h1>
        <p className="mt-3 text-ink-soft">
          {paid && (
            <>
              Order <span className="font-semibold text-ink">{order.number}</span> is paid and
              with our studio. A confirmation email is on the way.
            </>
          )}
          {failed && (
            <>
              Your order <span className="font-semibold text-ink">{order.number}</span> was created, but
              payment was declined. Nothing was charged — you can retry below.
            </>
          )}
          {!paid && !failed && awaiting === 'stripe' && (
            <>Finish the payment in your provider’s window; this page updates automatically.</>
          )}
          {!paid && !failed && !awaiting && (
            <>Hold on a few seconds while the payment provider confirms…</>
          )}
        </p>
        {failed && mockProviderEnabled && (
          <button className="btn-accent mt-5" onClick={() => router.back()}>
            <CreditCard size={16} aria-hidden /> Retry payment
          </button>
        )}
      </div>

      {/* Order summary */}
      <div className="card mt-10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Order</p>
            <p className="font-display text-xl font-semibold">{order.number}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={order.paymentStatus} />
            <StatusBadge status={order.fulfillmentStatus} />
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-faint">Placed {formatDate(order.placedAt)}</p>

        <ul className="mt-6 space-y-4 border-t border-line pt-6">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-cream">
                {item.previewUrl && <Image src={item.previewUrl} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="text-xs text-ink-faint">
                  {Object.entries(item.options).map(([k, v]) => (
                    <span key={k} className="mr-3">{k}: {v}</span>
                  ))}
                </span>
                <span className="text-xs text-ink-faint">Qty {item.quantity}</span>
              </span>
              <span className="text-sm font-medium">{formatMoney(item.lineTotalCents, order.currency)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatMoney(order.subtotalCents, order.currency)}</dd></div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-forest-600">
              <dt>Discount {order.couponCode && `(${order.couponCode})`}</dt>
              <dd>−{formatMoney(order.discountCents, order.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd>{order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents, order.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Tax</dt><dd>{formatMoney(order.taxCents, order.currency)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>Total</dt><dd>{formatMoney(order.totalCents, order.currency)}</dd>
          </div>
        </dl>
      </div>

      {/* Next steps */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="What happens next">
        {[
          { icon: Package, title: 'Made to order', body: 'Your art is printed & framed by hand (2–4 days).' },
          { icon: Truck, title: 'Tracked delivery', body: 'Corner-protected packaging, 3–7 days in transit.' },
          { icon: Clock, title: 'Real-time updates', body: 'Email + account notifications at every step.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card p-5">
            <Icon size={18} className="text-clay-600" aria-hidden />
            <h2 className="mt-2 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{body}</p>
          </div>
        ))}
      </div>

      {/* Shipping address */}
      <div className="card mt-8 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-soft">Delivering to</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {order.shippingAddress.firstName} {order.shippingAddress.lastName} · {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}
          {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
        </p>
      </div>
    </div>
  )
}
