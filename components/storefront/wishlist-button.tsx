'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Wishlist toggle — server-backed for signed-in users.
 * Guests are guided to sign in (wishlist is an account feature).
 */
export function WishlistButton({ productId }: { productId: string }) {
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/wishlist')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.data?.productIds?.includes(productId)) setActive(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [productId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/v1/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (res.status === 401) {
        router.push(`/signin?next=/wishlist`)
        return
      }
      const json = await res.json()
      if (res.ok) setActive(json.data.added)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
      className="relative z-10 -mr-1 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-white hover:text-clay-600"
    >
      <Heart size={17} strokeWidth={active ? 0 : 2} fill={active ? '#b0502f' : 'none'} className={cn(active && 'text-clay-600')} />
    </button>
  )
}
