'use client'

import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'

/** Recovery-friendly error boundary (never leaks internals). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Client-side telemetry hook: wire Sentry here (docs/observability.md).
    console.error('page error', { digest: error.digest })
  }, [error])

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50">
        <TriangleAlert size={28} className="text-red-600" aria-hidden />
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">Something slipped</h1>
      <p className="mt-3 text-ink-soft">
        A technical hiccup on our side — nothing on yours. Try again; if it keeps happening,
        our support team can help.
      </p>
      {error.digest && <p className="mt-2 text-xs text-ink-faint">Reference: {error.digest}</p>}
      <div className="mt-8 flex gap-3">
        <button onClick={reset} className="btn-primary">Try again</button>
        <a href="/support" className="btn-secondary">Contact support</a>
      </div>
    </div>
  )
}
