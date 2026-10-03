import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/security/session'
import { AccountNav } from './nav'

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/signin?next=/account')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Hi, {user.name.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[200px_1fr]">
        <AccountNav isAdmin={user.role === 'ADMIN'} />
        <div>{children}</div>
      </div>
    </div>
  )
}
