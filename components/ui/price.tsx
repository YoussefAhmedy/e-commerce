import { formatMoney } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

export function Price({
  cents,
  currency = 'USD',
  compareAtCents,
  className,
}: {
  cents: number
  currency?: string
  compareAtCents?: number | null
  className?: string
}) {
  const onSale = compareAtCents != null && compareAtCents > cents
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-semibold text-ink">{formatMoney(cents, currency)}</span>
      {onSale && (
        <span className="text-sm text-ink-faint line-through">
          {formatMoney(compareAtCents as number, currency)}
        </span>
      )}
    </span>
  )
}
