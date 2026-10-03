'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function cancel() {
    if (!confirm('Cancel this order? Reserved items will be released back to stock.')) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/v1/orders/${orderId}/cancel`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error?.message ?? 'Could not cancel the order.')
      return
    }
    router.refresh()
  }

  return (
    <div>
      <button onClick={cancel} disabled={busy} className="btn-danger">
        {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
        Cancel order
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
