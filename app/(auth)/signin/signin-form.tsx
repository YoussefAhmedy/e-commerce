'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '../auth-shell'

export function SignInForm({
  next,
  justVerified,
  verificationExpired,
}: {
  next: string
  justVerified: boolean
  verificationExpired: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Sign in failed. Please try again.')
        return
      }
      window.dispatchEvent(new Event('pq:cart'))
      const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/'
      router.replace(destination as never)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to track orders, save addresses and keep your wishlist."
    >
      {justVerified && (
        <p className="mb-4 rounded-xl bg-forest-500/10 px-4 py-3 text-sm font-medium text-forest-600">
          Email verified — you can sign in now.
        </p>
      )}
      {verificationExpired && (
        <p className="mb-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700">
          That verification link expired — check your inbox for a fresh one after signing in.
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link href={'/forgot-password' as never} className="text-xs font-medium text-clay-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" type="password" required autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full !py-3" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
          Sign in
        </button>

        <p className="text-center text-sm text-ink-soft">
          New to Printique?{' '}
          <Link href={'/signup' as never} className="font-semibold text-clay-700 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
