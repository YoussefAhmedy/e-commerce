import type { Metadata } from 'next'
import { Package } from 'lucide-react'
import { getSessionUser } from '@/lib/security/session'
import { listOrdersByUser } from '@/lib/db/repositories/orders'
import { OrderCard } from '../order-card'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Order history', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const user = (await getSessionUser())!
  const orders = listOrdersByUser(user.id, 50)

  return (
    <div>
      <h2 className="mb-6 font-display text-2xl font-semibold">Order history</h2>
      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          body="When you place an order, its status, tracking and invoice will live right here."
          action={{ href: '/catalog', label: 'Start shopping' }}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
