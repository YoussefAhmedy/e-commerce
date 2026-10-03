'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { saveCoupon, deleteCoupon } from '@/app/admin/actions'
import { formatMoney } from '@/lib/utils/format'
import type { Coupon } from '@/lib/db/types'

type Row = Coupon & { redemptions: number }

interface Draft {
  id?: string
  code: string
  type: 'PERCENT' | 'FIXED'
  value: string
  minSubtotal: string
  startsAt: string
  endsAt: string
  maxRedemptions: string
  perUserLimit: string
  active: boolean
}

function toDraft(c?: Row): Draft {
  return c
    ? {
        id: c.id, code: c.code, type: c.type,
        value: c.type === 'PERCENT' ? String(c.value) : (c.value / 100).toFixed(2),
        minSubtotal: c.minSubtotalCents ? (c.minSubtotalCents / 100).toFixed(2) : '',
        startsAt: c.startsAt?.slice(0, 10) ?? '',
        endsAt: c.endsAt?.slice(0, 10) ?? '',
        maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '',
        perUserLimit: String(c.perUserLimit),
        active: c.active,
      }
    : { code: '', type: 'PERCENT', value: '10', minSubtotal: '', startsAt: '', endsAt: '', maxRedemptions: '', perUserLimit: '1', active: true }
}

export function CouponPanel({ coupons }: { coupons: Row[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expired = (c: Row) => c.endsAt != null && c.endsAt < new Date().toISOString()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError(null)
    const valueNum = editing.type === 'PERCENT'
      ? Math.round(parseFloat(editing.value) || 0)
      : Math.round((parseFloat(editing.value) || 0) * 100)
    startTransition(async () => {
      const res = await saveCoupon({
        id: editing.id,
        code: editing.code.toUpperCase(),
        type: editing.type,
        value: valueNum,
        minSubtotalCents: editing.minSubtotal ? Math.round(parseFloat(editing.minSubtotal) * 100) : 0,
        startsAt: editing.startsAt ? new Date(`${editing.startsAt}T00:00:00Z`).toISOString() : null,
        endsAt: editing.endsAt ? new Date(`${editing.endsAt}T23:59:59Z`).toISOString() : null,
        maxRedemptions: editing.maxRedemptions ? parseInt(editing.maxRedemptions, 10) : null,
        perUserLimit: editing.perUserLimit ? parseInt(editing.perUserLimit, 10) : 1,
        active: editing.active,
      })
      if (!res.ok) { setError(res.error); return }
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setEditing(toDraft())} className="btn-primary gap-1.5">
          <Plus size={16} aria-hidden /> New coupon
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {editing && (
        <form onSubmit={submit} className="card grid gap-3 border-clay-200 p-5 sm:grid-cols-3" aria-label="Coupon form">
          <div>
            <label className="label" htmlFor="c-code">Code</label>
            <input id="c-code" className="input font-mono uppercase" required minLength={2} maxLength={40} pattern="[A-Za-z0-9-]+"
              value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label" htmlFor="c-type">Type</label>
            <select id="c-type" className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as Draft['type'] })}>
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Fixed amount off</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-value">{editing.type === 'PERCENT' ? 'Percent (1–100)' : 'Amount (USD)'}</label>
            <input id="c-value" className="input" type="number" min={1} step={editing.type === 'PERCENT' ? 1 : 0.01} required
              value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-min">Min subtotal (USD)</label>
            <input id="c-min" className="input" type="number" min={0} step="0.01" value={editing.minSubtotal}
              onChange={(e) => setEditing({ ...editing, minSubtotal: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-start">Starts</label>
            <input id="c-start" className="input" type="date" value={editing.startsAt} onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-end">Ends</label>
            <input id="c-end" className="input" type="date" value={editing.endsAt} onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-max">Max redemptions <span className="font-normal text-ink-faint">(blank = unlimited)</span></label>
            <input id="c-max" className="input" type="number" min={1} value={editing.maxRedemptions} onChange={(e) => setEditing({ ...editing, maxRedemptions: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-plimit">Per-customer limit (0 = guests only)</label>
            <input id="c-plimit" className="input" type="number" min={0} max={100} value={editing.perUserLimit} onChange={(e) => setEditing({ ...editing, perUserLimit: e.target.value })} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="accent-clay-600" />
            Active
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Saving…' : 'Save coupon'}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-ghost"><X size={14} aria-hidden /> Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-line">
        {coupons.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-mono font-bold">{c.code}</p>
              <p className="text-xs text-ink-faint">
                {c.type === 'PERCENT' ? `${c.value}% off` : `${formatMoney(c.value, 'USD')} off`}
                {c.minSubtotalCents > 0 && ` · min ${formatMoney(c.minSubtotalCents, 'USD')}`}
                {c.endsAt && ` · ends ${c.endsAt.slice(0, 10)}`}
                {` · used ${c.redemptions}${c.maxRedemptions != null ? `/${c.maxRedemptions}` : ''}`}
              </p>
            </div>
            {expired(c) ? <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">expired</span>
              : !c.active ? <span className="rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-semibold text-ink-soft">inactive</span>
              : <span className="rounded-full border border-forest-500/20 bg-forest-500/10 px-2.5 py-0.5 text-xs font-semibold text-forest-600">live</span>}
            <button type="button" onClick={() => setEditing(toDraft(c))} className="btn-ghost !px-2.5 !py-1.5 text-xs" aria-label={`Edit ${c.code}`}>
              <Pencil size={14} aria-hidden />
            </button>
            <button type="button" disabled={pending} aria-label={`Delete ${c.code}`}
              onClick={() => {
                if (!window.confirm(`Delete coupon ${c.code}? Existing orders keep their discounts.`)) return
                startTransition(async () => {
                  const res = await deleteCoupon(c.id)
                  if (!res.ok) setError(res.error)
                  else router.refresh()
                })
              }}
              className="btn-ghost !px-2.5 !py-1.5 text-xs text-ink-faint hover:text-red-600">
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        ))}
        {coupons.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No coupons yet — create one.</p>}
      </div>
    </div>
  )
}
