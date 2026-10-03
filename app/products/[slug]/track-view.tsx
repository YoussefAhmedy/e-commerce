'use client'

import { useEffect } from 'react'

/** Fire-and-forget product view analytics (purpose: trending + merchandising). */
export function TrackView({ productId }: { productId: string }) {
  useEffect(() => {
    fetch('/api/v1/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PRODUCT_VIEW', productId }),
    }).catch(() => undefined)
  }, [productId])
  return null
}
