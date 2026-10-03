import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { listOrders } from '@/lib/db/repositories/orders'
import type { OrderStatus, PaymentStatus } from '@/lib/db/types'
import { formatDateTime, formatMoney } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Orders' }
export const dynamic = 'force-dynamic'

const PAYMENTS: Array<PaymentStatus | ''> = ['', 'PENDING', 'PAID', 'FAILED', 'REFUNDED']
const STATUSES: Array<OrderStatus | ''> = ['', 'PENDING', 'CONFIRMED', 'CANCELLED']

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const payment = (typeof sp.payment === 'string' ? sp.payment : '') as PaymentStatus | ''
  const status = (typeof sp.status === 'string' ? sp.status : '') as OrderStatus | ''
  const q = typeof sp.q === 'string' ? sp.q : ''
  const page = Math.max(1, Number(sp.page) || 1)

  const { orders, total } = listOrders({
    paymentStatus: PAYMENTS.includes(payment) ? payment || undefined : undefined,
    status: STATUSES.includes(status) ? status || undefined : undefined,
    q: q || undefined,
    page,
    pageSize: 20,
  })
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-ink-soft">{total} orders · fulfillment is the thing to keep green</p>
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/orders">
        <input type="search" name="q" defaultValue={q} placeholder="Order # or email…" className="input min-w-52 flex-1" aria-label="Search orders" />
        <select name="payment" defaultValue={payment} className="input w-auto" aria-label="Payment status">
          {PAYMENTS.map((p) => <option key={p} value={p}>{p ? `Payment: ${p.toLowerCase()}` : 'Any payment'}</option>)}
        </select>
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Order status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? `Status: ${s.toLowerCase()}` : 'Any status'}</option>)}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
      </form>

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No matching orders" body="Adjust filters, or check back after the next checkout completes." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Placed</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Fulfillment</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line transition-colors hover:bg-cream/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}` as never} className="font-semibold hover:text-clay-700">{o.number}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDateTime(o.placedAt)}</td>
                  <td className="px-4 py-3 text-ink-soft">{o.guestEmail ?? `${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.paymentStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.fulfillmentStatus} /></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(o.totalCents, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/orders?q=${encodeURIComponent(q)}&payment=${payment}&status=${status}&page=${p}`} />
    </div>
  )
}
