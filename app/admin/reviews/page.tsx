import type { Metadata } from 'next'
import { Star } from 'lucide-react'
import { listPendingReviews } from '@/lib/db/repositories/engagement'
import { getProductById } from '@/lib/db/repositories/products'
import { EmptyState } from '@/components/ui/empty-state'
import { Stars } from '@/components/ui/stars'
import { ReviewModerationList } from './review-list'

export const metadata: Metadata = { title: 'Review moderation' }
export const dynamic = 'force-dynamic'

export default function AdminReviewsPage() {
  const pending = listPendingReviews().map((r) => ({
    ...r,
    productName: r.productId ? getProductById(r.productId)?.name ?? 'Deleted product' : 'Unknown product',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="text-sm text-ink-soft">Approve what’s genuine, reject spam — the queue empties and ratings update automatically.</p>
      </div>
      {pending.length === 0 ? (
        <EmptyState icon={Star} title="Queue is clear" body="No reviews awaiting moderation right now. New ones arrive when verified buyers post." />
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars rating={r.rating} />
                <p className="font-medium">{r.title}</p>
                <span className="text-xs text-ink-faint">for {r.productName} · {r.createdAt.slice(0, 10)}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{r.body}</p>
              <ReviewModerationList reviewId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
