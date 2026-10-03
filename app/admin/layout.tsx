import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/security/session'
import { AdminNav } from './nav'

export const metadata: Metadata = {
  title: { default: 'Admin studio', template: '%s · Printique Admin' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  // Server-side authorization — the nav link being hidden is irrelevant;
  // every admin page AND action re-checks the role independently.
  if (!user) redirect('/signin?next=/admin')
  if (user.role !== 'ADMIN') redirect('/')

  return (
    <div className="border-t border-line bg-cream/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
