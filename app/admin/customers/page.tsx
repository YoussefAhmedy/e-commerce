import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { listUsers, countUsers } from '@/lib/db/repositories/users'
import { formatDate, formatMoney } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Customers' }
export const dynamic = 'force-dynamic'

export default function AdminCustomersPage() {
  const users = listUsers(200)
  const total = countUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-ink-soft">{total} registered accounts — read-only; accounts manage themselves.</p>
      </div>
      {users.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" body="Accounts appear here after the first sign-up." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Verified</th>
                <th className="px-4 py-3 text-right font-semibold">Orders</th>
                <th className="px-4 py-3 text-right font-semibold">Lifetime value</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-ink-faint">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{u.role === 'ADMIN' ? <Badge tone="info">admin</Badge> : <Badge tone="neutral">customer</Badge>}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">{u.emailVerifiedAt ? <Badge tone="good">verified</Badge> : <Badge tone="warn">unverified</Badge>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.orderCount}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(u.totalSpentCents, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
