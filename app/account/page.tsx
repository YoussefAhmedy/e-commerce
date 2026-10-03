import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck, Package } from 'lucide-react'
import { getSessionUser } from '@/lib/security/session'
import { listOrdersByUser } from '@/lib/db/repositories/orders'
import { OrderCard } from './order-card'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'Account overview', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AccountOverviewPage() {
  const user = (await getSessionUser())!
  const orders = listOrdersByUser(user.id, 3)

  return (
    <div className="space-y-8">
      {!user.emailVerifiedAt && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 px-5 py-4">
          <MailCheck className="mt-0.5 shrink-0 text-amber-700" size={18} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-800">Verify your email address</p>
            <p className="mt-0.5 text-sm text-amber-700">
              We sent a verification link when you registered — confirming protects your account and order updates.
            </p>
          </div>
        </div>
      )}

      <section aria-labelledby="recent-orders">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-orders" className="font-display text-xl font-semibold">Recent orders</h2>
          <Link href={'/account/orders' as never} className="text-sm font-medium text-clay-700 hover:underline">
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line bg-white/60 p-6">
            <Package className="shrink-0 text-ink-faint" size={24} aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-semibold">No orders yet</p>
              <p className="text-sm text-ink-soft">Your pieces and their tracking will appear here.</p>
            </div>
            <Link href={'/catalog' as never} className="btn-secondary text-sm">Browse prints</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="profile">
        <h2 id="profile" className="mb-4 font-display text-xl font-semibold">Profile</h2>
        <ProfileForm initialName={user.name} email={user.email} />
      </section>
    </div>
  )
}
