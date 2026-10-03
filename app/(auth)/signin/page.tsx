import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/security/session'
import { SignInForm } from './signin-form'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await getSessionUser()
  const sp = await searchParams
  if (user) redirect((sp.next as `/${string}`) ?? '/account')
  return (
    <SignInForm
      next={sp.next ?? ''}
      justVerified={sp.verified === '1'}
      verificationExpired={sp.verified === '0'}
    />
  )
}
