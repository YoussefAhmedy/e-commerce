'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '../auth-shell'

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const valid = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password) && password === confirm

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(json?.error?.message ?? 'Could not reset your password.')
      return
    }
    router.replace('/signin' as never)
    router.refresh()
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This password reset link is missing its token.">
        <Link href={'/forgot-password' as never} className="btn-primary w-full">
          Request a new link
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don’t use elsewhere.">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="password" className="label">New password</label>
          <input id="password" type="password" required autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirm new password</label>
          <input id="confirm" type="password" required autoComplete="new-password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {confirm && password !== confirm && <p className="mt-1 text-xs text-red-600">Passwords don’t match.</p>}
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary w-full !py-3" disabled={busy || !valid}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
          Update password
        </button>
      </form>
    </AuthShell>
  )
}
