'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { AuthShell } from '../auth-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => undefined)
    setBusy(false)
    setDone(true) // uniform response — never leak account existence
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure link to set a new password.">
      {done ? (
        <div className="text-center">
          <MailCheck className="mx-auto text-forest-600" size={36} aria-hidden />
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            If an account exists for <span className="font-semibold text-ink">{email}</span>, a reset link is on its way.
            It expires in one hour.
          </p>
          <Link href={'/signin' as never} className="btn-secondary mt-6 w-full">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button type="submit" className="btn-primary w-full !py-3" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Send reset link
          </button>
          <Link href={'/signin' as never} className="btn-ghost mx-auto flex w-fit items-center gap-1.5 text-sm">
            <ArrowLeft size={14} aria-hidden /> Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
