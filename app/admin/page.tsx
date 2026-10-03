import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { dashboardMetrics } from '@/lib/services/admin-metrics'
import { lowStockVariants } from '@/lib/db/repositories/products'
import { countPendingReviews } from '@/lib/db/repositories/engagement'
import { listOrders } from '@/lib/db/repositories/orders'
import { formatMoney } from '@/lib/utils/format'
import { StatusBadge } from '@/components/ui/badge'
import { RevenueChart } from './revenue-chart'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

function MetricCard({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const inner = (
    <div className="card p-5 transition-shadow hover:shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  )
  return href ? <Link href={href as never}>{inner}</Link> : inner
}

export default async function AdminDashboardPage() {
  const m = dashboardMetrics(30)
  const lowStock = lowStockVariants(3)
  const pendingReviews = countPendingReviews()
  const { orders: recent } = listOrders({ pageSize: 6 })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Good day, studio</h1>
        <p className="mt-1 text-sm text-ink-soft">Last {m.period} · {formatMoney(m.revenueCents, 'USD')} in paid revenue</p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Revenue" value={formatMoney(m.revenueCents, 'USD')} sub={`${m.paidOrders} paid orders`} href="/admin/orders" />
        <MetricCard label="Avg. order value" value={formatMoney(m.averageOrderValueCents, 'USD')} sub={`${m.unitsSold} pieces sold`} />
        <MetricCard label="Needs fulfillment" value={String(m.pendingOrders)} sub="paid, not yet shipped" href="/admin/orders?payment=PAID" />
        <MetricCard label="Awaiting payment" value={String(m.openPayments)} sub="checkouts in progress" href="/admin/orders?payment=PENDING" />
      </div>

      {/* Revenue chart */}
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Revenue, last 30 days</h2>
          <span className="text-xs text-ink-faint">
            View→purchase rate: {m.conversion.rate != null ? `${(m.conversion.rate * 100).toFixed(2)}%` : 'n/a'}
          </span>
        </div>
        <RevenueChart data={m.revenueByDay} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold">Top products by revenue</h2>
          {m.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-faint">No paid orders in this window yet.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-faint">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 text-right font-semibold">Units</th>
                  <th className="pb-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {m.topProducts.map((p, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.units}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{formatMoney(p.revenueCents, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Attention queue */}
        <div className="space-y-4">
          {lowStock.length > 0 && (
            <div className="card border-amber-200 bg-amber-50/50 p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-700" aria-hidden />
                <h2 className="text-sm font-bold text-amber-800">Low stock</h2>
                <Link href={'/admin/products' as never} className="ml-auto text-xs font-semibold text-amber-800 hover:underline">
                  Manage <ArrowRight size={11} className="inline" aria-hidden />
                </Link>
              </div>
              <ul className="mt-3 space-y-1.5">
                {lowStock.slice(0, 5).map((v) => (
                  <li key={v.id} className="flex justify-between text-sm text-amber-900">
                    <span>{v.productName} — {v.name}</span>
                    <span className="font-semibold tabular-nums">{v.stock - v.reserved} left</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pendingReviews > 0 && (
            <div className="card border-clay-200 bg-clay-50/50 p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-clay-800">{pendingReviews} review{pendingReviews !== 1 && 's'} awaiting moderation</h2>
                <Link href={'/admin/reviews' as never} className="ml-auto text-xs font-semibold text-clay-700 hover:underline">
                  Review <ArrowRight size={11} className="inline" aria-hidden />
                </Link>
              </div>
            </div>
          )}

          {/* Recent orders */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Latest orders</h2>
              <Link href={'/admin/orders' as never} className="text-xs font-semibold text-clay-700 hover:underline">
                All orders <ArrowRight size={11} className="inline" aria-hidden />
              </Link>
            </div>
            <ul className="mt-3 space-y-2">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}` as never} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-cream">
                    <span className="font-semibold">{o.number}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={o.paymentStatus} />
                      <span className="font-medium tabular-nums">{formatMoney(o.totalCents, o.currency)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
