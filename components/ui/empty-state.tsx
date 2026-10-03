import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/** Polished empty state: what happened + what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream">
        <Icon className="h-7 w-7 text-ink-soft" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
      {action && (
        <Link href={action.href as never} className="btn-primary mt-6">
          {action.label}
        </Link>
      )}
    </div>
  )
}
