import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/security/session'
import { SecurityForm } from './security-form'

export const metadata: Metadata = { title: 'Security', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const user = (await getSessionUser())!
  return (
    <div className="space-y-8">
      <h2 className="font-display text-2xl font-semibold">Security</h2>
      <SecurityForm
        emailVerified={Boolean(user.emailVerifiedAt)}
        currentEmail={user.email}
      />
    </div>
  )
}
