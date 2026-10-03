import { cn } from '@/lib/utils/cn'
import { statusTone } from '@/lib/utils/format'

const tones = {
  neutral: 'bg-cream text-ink-soft border-line',
  good: 'bg-forest-500/10 text-forest-600 border-forest-500/20',
  warn: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  bad: 'bg-red-500/10 text-red-700 border-red-500/20',
  info: 'bg-clay-50 text-clay-700 border-clay-100',
} as const

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
      )}
    >
      {label ?? status.replaceAll('_', ' ')}
    </span>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  )
}
