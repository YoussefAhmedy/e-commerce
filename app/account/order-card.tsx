import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Order } from '@/lib/db/types'
import { formatDate, formatMoney } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/badge'

export function OrderCard({ order }: { order: Order }) {
  return (
    <Link
      href={`/account/orders/${order.id}` as never}
      className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{order.number}</span>
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          {formatDate(order.placedAt)} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
        </p>
      </div>
      <span className="text-sm font-semibold">{formatMoney(order.totalCents, order.currency)}</span>
      <ChevronRight size={16} className="text-ink-faint" aria-hidden />
    </Link>
  )
}
