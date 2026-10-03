import { Star, StarHalf } from 'lucide-react'

export function Stars({ rating, count, size = 14 }: { rating: number | null; count?: number; size?: number }) {
  if (rating == null) {
    return <span className="text-xs text-ink-faint">No reviews yet</span>
  }
  const full = Math.round(rating - 0.25)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex text-clay-500" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} strokeWidth={0} fill={i <= full ? 'currentColor' : '#e7e0d7'} />
        ))}
      </span>
      <span className="text-xs text-ink-soft">
        {rating.toFixed(1)}{count != null && ` (${count})`}
      </span>
      <span className="sr-only">Rated {rating.toFixed(1)} out of 5{count != null ? ` from ${count} reviews` : ''}</span>
    </span>
  )
}
