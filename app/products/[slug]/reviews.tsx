'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Star } from 'lucide-react'
import type { Review } from '@/lib/db/types'
import { Stars } from '@/components/ui/stars'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

export function ReviewsSection({
  productId,
  productSlug,
  initialReviews,
  ratingAvg,
  ratingCount,
}: {
  productId: string
  productSlug: string
  initialReviews: Review[]
  ratingAvg: number | null
  ratingCount: number
}) {
  const [reviews, setReviews] = useState(initialReviews)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/v1/products/${productSlug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title, body }),
      })
      const json = await res.json()
      if (res.status === 401) {
        router.push(`/signin?next=/products/${productSlug}`)
        return
      }
      setMessage(res.ok ? json.data.message : json?.error?.message ?? 'Could not submit your review.')
      if (res.ok) {
        setShowForm(false)
        setBody('')
        setTitle('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="reviews" className="mt-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="reviews" className="font-display text-2xl font-semibold tracking-tight">Reviews</h2>
          <div className="mt-1.5">
            <Stars rating={ratingAvg} count={ratingCount} size={16} />
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setShowForm((s) => !s)}>
          Write a review
        </button>
      </div>

      {message && (
        <p role="status" className="mt-4 rounded-xl bg-forest-500/10 px-4 py-3 text-sm font-medium text-forest-600">
          {message}
        </p>
      )}

      {showForm && (
        <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
          <div>
            <span className="label">Your rating</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setRating(n)}
                  className="rounded-lg p-1 transition-transform hover:scale-110"
                >
                  <Star size={26} strokeWidth={0} fill={n <= rating ? '#c05f3d' : '#e7e0d7'} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="review-title">Title (optional)</label>
            <input id="review-title" className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarize it in a line" />
          </div>
          <div>
            <label className="label" htmlFor="review-body">Review</label>
            <textarea id="review-body" className="field min-h-28" required minLength={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How's the print quality in person? How does it look on your wall?" />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit review'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <p className="text-xs text-ink-faint">Reviews from verified purchases publish immediately; others go through moderation.</p>
        </form>
      )}

      <div className="mt-8 space-y-4">
        {reviews.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center text-sm text-ink-soft">
            No reviews yet — own this piece? Share how it looks in your space.
          </p>
        )}
        {reviews.map((r) => (
          <article key={r.id} className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-xs font-bold text-ink-soft" aria-hidden>
                  {r.userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm font-semibold">{r.userName}</span>
                {r.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-600">
                    <BadgeCheck size={13} aria-hidden /> Verified purchase
                  </span>
                )}
              </div>
              <time className="text-xs text-ink-faint" dateTime={r.createdAt}>{formatDate(r.createdAt)}</time>
            </div>
            <div className="mt-3"><Stars rating={r.rating} /></div>
            {r.title && <h3 className="mt-2 text-sm font-semibold">{r.title}</h3>}
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{r.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
