import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/security/session'
import { getOrderById } from '@/lib/db/repositories/orders'
import { canTransition } from '@/lib/domain/order-fsm'
import { formatDateTime, formatMoney } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/badge'
import { CancelOrderButton } from './cancel-button'

export const metadata: Metadata = { title: 'Order details', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = (await getSessionUser())!
  const order = getOrderById(id)
  // IDOR guard: non-admins can only ever see their own orders.
  if (!order || (order.userId !== user.id && user.role !== 'ADMIN')) notFound()

  const steps = [
    { label: 'Paid', done: order.paymentStatus === 'PAID' },
    { label: 'Processing', done: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.fulfillmentStatus) },
    { label: 'Shipped', done: ['SHIPPED', 'DELIVERED'].includes(order.fulfillmentStatus) },
    { label: 'Delivered', done: order.fulfillmentStatus === 'DELIVERED' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">{order.number}</h2>
          <p className="mt-1 text-sm text-ink-faint">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
          {order.status === 'CANCELLED' && <StatusBadge status={order.status} />}
        </div>
      </div>

      {/* Progress tracker */}
      {order.status !== 'CANCELLED' && (
        <ol className="flex items-center" aria-label="Order progress">
          {steps.map((s, i) => (
            <li key={s.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span className={`h-3 w-3 rounded-full ${s.done ? 'bg-forest-600' : 'bg-line'}`} aria-hidden />
                <span className={`text-xs ${s.done ? 'font-semibold text-ink' : 'text-ink-faint'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <span className={`mx-2 mb-4 h-0.5 flex-1 ${steps[i + 1]?.done ? 'bg-forest-600' : 'bg-line'}`} aria-hidden />}
            </li>
          ))}
        </ol>
      )}

      {order.trackingNumber && (
        <p className="rounded-2xl bg-cream px-5 py-3 text-sm">
          <span className="font-semibold">Tracking:</span> {order.carrier} · {order.trackingNumber}
        </p>
      )}

      <section className="card p-6" aria-label="Items">
        <ul className="space-y-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-cream">
                {item.previewUrl && <Image src={item.previewUrl} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-ink-faint">
                  {Object.entries(item.options).map(([k, v]) => (
                    <span key={k} className="mr-3">{k}: {v}</span>
                  ))}
                </p>
              </div>
              <p className="text-sm font-medium">
                {formatMoney(item.unitPriceCents, order.currency)} × {item.quantity}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatMoney(order.subtotalCents, order.currency)}</dd></div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-forest-600"><dt>Discount</dt><dd>−{formatMoney(order.discountCents, order.currency)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd>{order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents, order.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Tax</dt><dd>{formatMoney(order.taxCents, order.currency)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{formatMoney(order.totalCents, order.currency)}</dd></div>
        </dl>
      </section>

      <section className="card p-6" aria-label="Shipping address">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-ink-soft">Shipping address</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
          {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
          {order.shippingAddress.city}{order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
        </p>
      </section>

      {canTransition(order, 'CANCEL') && <CancelOrderButton orderId={order.id} />}
    </div>
  )
}
