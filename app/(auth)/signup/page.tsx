import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/security/session'
import { SignUpForm } from './signup-form'

export const metadata: Metadata = { title: 'Create account', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await getSessionUser()
  if (user) redirect('/account')
  const sp = await searchParams
  return <SignUpForm next={sp.next ?? ''} />
}
