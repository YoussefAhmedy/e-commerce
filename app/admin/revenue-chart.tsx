'use client'

import { formatMoney } from '@/lib/utils/format'

/**
 * Dependency-free SVG revenue bars — accessible table data rendered visually.
 * (Chart libs are welcome later; this keeps the bundle honest.)
 */
export function RevenueChart({ data }: { data: Array<{ day: string; revenueCents: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.revenueCents))
  const height = 160
  const barWidth = 100 / Math.max(data.length, 1)

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-faint">No paid revenue in this window yet.</p>
  }

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Revenue by day bar chart"
      >
        {data.map((d, i) => {
          const h = (d.revenueCents / max) * (height - 24)
          return (
            <rect
              key={d.day}
              x={i * barWidth + barWidth * 0.15}
              y={height - h}
              width={barWidth * 0.7}
              height={h}
              rx="1.5"
              fill="var(--color-clay-500)"
              opacity={0.55 + (d.revenueCents / max) * 0.45}
            >
              <title>{`${d.day}: ${formatMoney(d.revenueCents, 'USD')}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{data[0]?.day.slice(5)}</span>
        <span>peak {formatMoney(max, 'USD')}</span>
        <span>{data[data.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  )
}
