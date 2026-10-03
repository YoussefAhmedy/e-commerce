import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Server-rendered pagination — links carry the full query string forward.
 */
export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number
  totalPages: number
  makeHref: (page: number) => string
}) {
  if (totalPages <= 1) return null
  const window = 5
  const start = Math.max(1, Math.min(page - Math.floor(window / 2), totalPages - window + 1))
  const pages = Array.from({ length: Math.min(window, totalPages) }, (_, i) => start + i)

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={makeHref(page - 1) as never} className="btn-ghost !px-3" aria-label="Previous page">
          <ChevronLeft size={16} aria-hidden />
        </Link>
      )}
      {start > 1 && <span className="px-2 text-ink-faint">…</span>}
      {pages.map((p) => (
        <Link
          key={p}
          href={makeHref(p) as never}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
            p === page ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-cream',
          )}
        >
          {p}
        </Link>
      ))}
      {start + window - 1 < totalPages && <span className="px-2 text-ink-faint">…</span>}
      {page < totalPages && (
        <Link href={makeHref(page + 1) as never} className="btn-ghost !px-3" aria-label="Next page">
          <ChevronRight size={16} aria-hidden />
        </Link>
      )}
    </nav>
  )
}
