import type { Metadata } from 'next'
import { countCouponRedemptions, listCoupons } from '@/lib/db/repositories/orders'
import { formatMoney } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { CouponPanel } from './coupon-panel'

export const metadata: Metadata = { title: 'Coupons' }
export const dynamic = 'force-dynamic'

export default function AdminCouponsPage() {
  const coupons = listCoupons().map((c) => ({
    ...c,
    redemptions: countCouponRedemptions(c.id, null).total,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Coupons</h1>
        <p className="text-sm text-ink-soft">Discounts are validated and applied server-side at checkout — totals are always recomputed.</p>
      </div>
      <CouponPanel coupons={coupons} />
    </div>
  )
}
