'use client'

import { useState } from 'react'
import { Bell, CheckCheck, CreditCard, Package, Truck } from 'lucide-react'
import type { Notification } from '@/lib/db/types'
import { formatDateTime } from '@/lib/utils/format'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'

const ICONS: Record<string, typeof Package> = {
  ORDER_PAID: CreditCard,
  ORDER_SHIPPED: Truck,
  PAYMENT_FAILED: CreditCard,
}

export function NotificationsClient({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications)

  async function markAllRead() {
    await fetch('/api/v1/notifications', { method: 'POST' })
    setNotifications((n) => n.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })))
  }

  const unread = notifications.filter((n) => !n.readAt).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Notifications</h2>
        {unread > 0 && (
          <button className="btn-secondary text-sm" onClick={markAllRead}>
            <CheckCheck size={15} aria-hidden /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          body="Order updates, shipping notices and account alerts will land here."
        />
      ) : (
        <ul className="space-y-2.5">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Package
            return (
              <li
                key={n.id}
                className={cn(
                  'card flex gap-4 p-4',
                  !n.readAt && 'border-l-2 border-l-clay-500 bg-clay-50/40',
                )}
              >
                <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', !n.readAt ? 'bg-clay-100 text-clay-700' : 'bg-cream text-ink-faint')}>
                  <Icon size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm', !n.readAt && 'font-semibold')}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>}
                  <p className="mt-1 text-xs text-ink-faint">{formatDateTime(n.createdAt)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
