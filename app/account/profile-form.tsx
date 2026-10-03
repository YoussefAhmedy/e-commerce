'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const res = await fetch('/api/v1/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setBusy(false)
    setMessage(res.ok ? 'Profile updated.' : 'Could not update your profile.')
  }

  return (
    <form onSubmit={submit} className="card max-w-lg space-y-4 p-6">
      <div>
        <label htmlFor="profile-name" className="label">Display name</label>
        <input id="profile-name" className="field" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="profile-email" className="label">Email</label>
        <input id="profile-email" className="field opacity-60" value={email} disabled aria-describedby="email-hint" />
        <p id="email-hint" className="mt-1 text-xs text-ink-faint">Email changes are handled by support for security.</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || name.trim().length < 2}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Save changes
        </button>
        {message && <p role="status" className="text-sm text-forest-600">{message}</p>}
      </div>
    </form>
  )
}
