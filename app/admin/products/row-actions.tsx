'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive } from 'lucide-react'
import { archiveProduct } from '@/app/admin/actions'

export function RowActions({ productId, status }: { productId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (status === 'ARCHIVED') return null
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('Archive this product? It disappears from the storefront but keeps its order history.')) return
        startTransition(async () => {
          const res = await archiveProduct(productId)
          if (!res.ok) setError(res.error)
          router.refresh()
        })
      }}
      className="btn-ghost !px-2.5 !py-1.5 text-xs text-ink-faint hover:text-red-600"
      title="Archive product"
    >
      <Archive size={14} aria-hidden />
      {error && <span className="sr-only">{error}</span>}
      Archive
    </button>
  )
}
