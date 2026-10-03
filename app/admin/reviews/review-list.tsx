'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moderateReview } from '@/app/admin/actions'

export function ReviewModerationList({ reviewId }: { reviewId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function decide(status: 'APPROVED' | 'REJECTED') {
    setError(null)
    startTransition(async () => {
      const res = await moderateReview({ reviewId, status })
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => decide('APPROVED')} className="btn-primary !py-2">Approve</button>
      <button type="button" disabled={pending} onClick={() => decide('REJECTED')} className="btn-secondary !border-red-200 !py-2 !text-red-700 hover:!bg-red-50">Reject</button>
      {error && <span role="alert" className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
