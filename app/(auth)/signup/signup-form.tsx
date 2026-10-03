'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { AuthShell } from '../auth-shell'
import { cn } from '@/lib/utils/cn'

export function SignUpForm({ next }: { next: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const router = useRouter()

  const rules = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[a-zA-Z]/.test(password), label: 'A letter' },
    { ok: /[0-9]/.test(password), label: 'A number' },
  ]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rules.some((r) => !r.ok)) return
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json?.error?.details) setFieldErrors(json.error.details)
        setError(json?.error?.message ?? 'Could not create your account.')
        return
      }
      window.dispatchEvent(new Event('pq:cart'))
      const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/?welcome=1'
      router.replace(destination as never)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Save addresses, track orders, and keep a wishlist of pieces you love.">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" required maxLength={80} autoComplete="name" className={cn('field', fieldErrors.name && 'field-error')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>}
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" className={cn('field', fieldErrors.email && 'field-error')} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email[0]}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" required autoComplete="new-password" className={cn('field', fieldErrors.password && 'field-error')} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {rules.map((r) => (
              <li key={r.label} className={cn('flex items-center gap-1 text-xs', r.ok ? 'text-forest-600' : 'text-ink-faint')}>
                {r.ok ? <Check size={11} aria-hidden /> : <X size={11} aria-hidden />}
                {r.label}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full !py-3" disabled={busy || rules.some((r) => !r.ok)}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
          Create account
        </button>

        <p className="text-center text-sm text-ink-soft">
          Already have an account?{' '}
          <Link href={'/signin' as never} className="font-semibold text-clay-700 hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs leading-relaxed text-ink-faint">
          By creating an account you agree to our{' '}
          <Link href={'/terms' as never} className="underline">Terms</Link> and{' '}
          <Link href={'/privacy' as never} className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  )
}
