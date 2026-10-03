import type { Metadata } from 'next'
import { ResetPasswordForm } from './reset-form'

export const metadata: Metadata = { title: 'Set a new password', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  return <ResetPasswordForm token={sp.token ?? ''} />
}
