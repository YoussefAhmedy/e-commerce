import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, MapPin } from 'lucide-react'
import { getOrderById } from '@/lib/db/repositories/orders'
import { availableActions } from '@/lib/domain/order-fsm'
import { formatDateTime, formatMoney } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/badge'
import { TransitionButtons } from './transition-buttons'

export const metadata: Metadata = { title: 'Order' }
export const dynamic = 'force-dynamic'

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = getOrderById(id)
  if (!order) notFound()
  const actions = availableActions(order).filter((a) => a !== 'MARK_PAID' && a !== 'MARK_PAYMENT_FAILED')
  const a = order.shippingAddress

  return (
    <div className="space-y-6">
      <div>
        <Link href={'/admin/orders' as never} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ChevronLeft size={15} aria-hidden /> All orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{order.number}</h1>
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Placed {formatDateTime(order.placedAt)} · {order.guestEmail ?? 'registered customer'} · idempotency key <code className="text-xs">{order.idempotencyKey.slice(0, 13)}…</code>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Items */}
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold">Items</h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-3.5">
                {item.previewUrl ? (
                  // order line snapshots may be remote/data URLs
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="h-16 w-16 rounded-lg border border-line bg-cream object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-cream" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-ink-faint">
                    {Object.values(item.options).filter(Boolean).join(' · ') || 'standard'} · SKU {item.sku}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="tabular-nums">{item.quantity} × {formatMoney(item.unitPriceCents, order.currency)}</p>
                  <p className="font-semibold tabular-nums">{formatMoney(item.lineTotalCents, order.currency)}</p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotalCents, order.currency)}</dd></div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-forest-600">
                <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                <dd className="tabular-nums">−{formatMoney(order.discountCents, order.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between"><dt className="text-ink-soft">Shipping ({order.shippingMethod})</dt><dd className="tabular-nums">{order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents, order.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Tax</dt><dd className="tabular-nums">{formatMoney(order.taxCents, order.currency)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.totalCents, order.currency)}</dd></div>
          </dl>
        </div>

        <div className="space-y-6">
          {/* Fulfillment actions */}
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Fulfillment</h2>
            {order.trackingNumber && (
              <p className="mt-2 text-sm text-ink-soft">
                {order.carrier ?? 'Carrier'} · <span className="font-mono">{order.trackingNumber}</span>
              </p>
            )}
            <TransitionButtons orderId={order.id} actions={actions} />
          </div>

          {/* Address */}
          <div className="card p-5">
            <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold">
              <MapPin size={16} aria-hidden /> Shipping address
            </h2>
            <address className="mt-3 text-sm not-italic leading-relaxed text-ink-soft">
              {a.firstName} {a.lastName}<br />
              {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
              {a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}<br />
              {a.country}
            </address>
          </div>
        </div>
      </div>
    </div>
  )
}
