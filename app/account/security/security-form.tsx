'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'

export function SecurityForm({ emailVerified, currentEmail }: { emailVerified: boolean; currentEmail: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [resendBusy, setResendBusy] = useState(false)
  const [resendNote, setResendNote] = useState<string | null>(null)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) return
    setBusy(true)
    setMessage(null)
    const res = await fetch('/api/v1/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const json = await res.json()
    setBusy(false)
    setMessage(res.ok
      ? { ok: true, text: 'Password updated. Other sessions were signed out.' }
      : { ok: false, text: json?.error?.message ?? 'Could not change the password.' })
    if (res.ok) {
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  async function resendVerification() {
    setResendBusy(true)
    const res = await fetch('/api/v1/auth/resend-verification', { method: 'POST' }).catch(() => null)
    setResendBusy(false)
    setResendNote(res && res.ok ? 'A fresh verification link is on its way.' : 'Could not send right now — try again in a minute.')
  }

  return (
    <div className="space-y-6">
      <div className="card flex items-start gap-4 p-6">
        <ShieldCheck size={22} className={emailVerified ? 'text-forest-600' : 'text-amber-600'} aria-hidden />
        <div>
          <p className="text-sm font-semibold">Email verification</p>
          <p className="mt-1 text-sm text-ink-soft">
            {emailVerified
              ? `${currentEmail} is verified.`
              : `${currentEmail} is not verified yet. Check your inbox for the link we sent.`}
          </p>
          {!emailVerified && (
            <button onClick={resendVerification} disabled={resendBusy} className="mt-2 text-sm font-medium text-clay-700 hover:underline">
              {resendBusy ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
          {resendNote && <p className="mt-1 text-xs text-forest-600">{resendNote}</p>}
        </div>
      </div>

      <form onSubmit={changePassword} className="card max-w-lg space-y-4 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-ink-soft">Change password</h3>
        <div>
          <label htmlFor="cur-pw" className="label">Current password</label>
          <input id="cur-pw" type="password" required autoComplete="current-password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label htmlFor="new-pw" className="label">New password</label>
          <input id="new-pw" type="password" required autoComplete="new-password" className="field" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-rules" />
          <p id="pw-rules" className="mt-1 text-xs text-ink-faint">8+ characters, at least one letter and one number.</p>
        </div>
        <div>
          <label htmlFor="cnf-pw" className="label">Confirm new password</label>
          <input id="cnf-pw" type="password" required autoComplete="new-password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {confirm && next !== confirm && <p className="mt-1 text-xs text-red-600">Passwords don’t match.</p>}
        </div>
        {message && (
          <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.ok ? 'bg-forest-500/10 text-forest-600' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy || next.length < 8 || next !== confirm}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Update password
        </button>
      </form>
    </div>
  )
}
