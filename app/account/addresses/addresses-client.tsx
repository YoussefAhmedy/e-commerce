'use client'

import { useState } from 'react'
import { Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import type { Address } from '@/lib/db/types'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'

export function AddressesClient({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState(initialAddresses)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const empty = {
    firstName: '', lastName: '', line1: '', line2: '', city: '',
    state: '', postalCode: '', country: 'US', phone: '', label: 'Home', isDefault: false,
  }
  const [form, setForm] = useState(empty)

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/v1/account/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(json?.error?.message ?? 'Could not save the address.')
      return
    }
    setAddresses((a) => [json.data.address, ...a])
    setShowForm(false)
    setForm(empty)
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v1/account/addresses?id=${id}`, { method: 'DELETE' })
    if (res.ok) setAddresses((a) => a.filter((x) => x.id !== id))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Addresses</h2>
        <button className="btn-secondary text-sm" onClick={() => setShowForm((s) => !s)}>
          <Plus size={15} aria-hidden /> Add address
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="a-fn">First name</label><input id="a-fn" required className="field" value={form.firstName} onChange={set('firstName')} /></div>
            <div><label className="label" htmlFor="a-ln">Last name</label><input id="a-ln" required className="field" value={form.lastName} onChange={set('lastName')} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="a-l1">Street</label><input id="a-l1" required className="field" value={form.line1} onChange={set('line1')} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="a-l2">Apt / suite (optional)</label><input id="a-l2" className="field" value={form.line2} onChange={set('line2')} /></div>
            <div><label className="label" htmlFor="a-city">City</label><input id="a-city" required className="field" value={form.city} onChange={set('city')} /></div>
            <div><label className="label" htmlFor="a-state">State / region</label><input id="a-state" className="field" value={form.state} onChange={set('state')} /></div>
            <div><label className="label" htmlFor="a-zip">Postal code</label><input id="a-zip" required className="field" value={form.postalCode} onChange={set('postalCode')} /></div>
            <div>
              <label className="label" htmlFor="a-country">Country</label>
              <select id="a-country" className="field" value={form.country} onChange={set('country')}>
                {['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'AU', 'EG', 'AE'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4 rounded accent-clay-600" checked={form.isDefault} onChange={set('isDefault')} />
            Make this my default address
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden />} Save address
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          body="Save an address for a faster checkout next time."
          action={{ href: '/catalog', label: 'Browse prints' }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="card relative p-5">
              {a.isDefault && <span className="absolute right-4 top-4"><Badge tone="info">Default</Badge></span>}
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {a.firstName} {a.lastName}<br />
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
                {a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}, {a.country}
              </p>
              <button
                onClick={() => remove(a.id)}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-faint hover:text-red-600"
                aria-label={`Delete address ${a.label}`}
              >
                <Trash2 size={12} aria-hidden /> Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
