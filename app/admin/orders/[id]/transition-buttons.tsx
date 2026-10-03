'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adminTransitionOrder } from '@/app/admin/actions'
import type { OrderAction } from '@/lib/domain/order-fsm'

const BUTTONS: Record<string, { label: string; variant: 'primary' | 'secondary' | 'danger'; needsTracking?: boolean }> = {
  START_PROCESSING: { label: 'Start processing', variant: 'primary' },
  SHIP: { label: 'Mark shipped', variant: 'primary', needsTracking: true },
  DELIVER: { label: 'Mark delivered', variant: 'secondary' },
  CANCEL: { label: 'Cancel order', variant: 'danger' },
  REFUND: { label: 'Refund payment', variant: 'danger' },
}

export function TransitionButtons({ orderId, actions }: { orderId: string; actions: OrderAction[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState('')
  const [carrier, setCarrier] = useState('')
  const needsTracking = actions.includes('SHIP')

  if (actions.length === 0) {
    return <p className="mt-3 text-sm text-ink-faint">No transitions available — this order is at the end of its lifecycle.</p>
  }

  function fire(action: string, needsTracking?: boolean) {
    if (needsTracking && !window.confirm('Ship this order with the tracking details shown?')) return
    if ((action === 'CANCEL' || action === 'REFUND') && !window.confirm(`Really ${action === 'REFUND' ? 'refund (auto-restock happens)' : 'cancel'} this order? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const res = await adminTransitionOrder(
        { action, ...(tracking.trim() ? { trackingNumber: tracking.trim(), carrier: carrier.trim() || undefined } : {}) },
        orderId,
      )
      if (!res.ok) { setError(res.error); return }
      setTracking('')
      setCarrier('')
      router.refresh()
    })
  }

  return (
    <div className="mt-3 space-y-3">
      {needsTracking && (
        <div className="grid gap-2 rounded-xl bg-cream/60 p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Tracking (required for shipping)</label>
          <input className="input" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} aria-label="Tracking number" required />
          <input className="input" placeholder="Carrier (e.g. DHL)" value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Carrier" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const meta = BUTTONS[a]
          if (!meta) return null
          const needs = Boolean(meta.needsTracking)
          return (
            <button
              key={a}
              type="button"
              disabled={pending || (needs && !tracking.trim())}
              onClick={() => fire(a, needs)}
              className={meta.variant === 'primary' ? 'btn-primary' : meta.variant === 'danger' ? 'btn-secondary !border-red-200 !text-red-700 hover:!bg-red-50' : 'btn-secondary'}
            >
              {pending ? 'Working…' : meta.label}
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
