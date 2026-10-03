'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'

/**
 * Sandbox cashier — posts the gateway-signed event to OUR webhook,
 * exactly like a real provider would. The browser decides nothing;
 * the webhook verifies the signature and settles the order.
 */
export function PayForm({
  intent,
  amountCents,
  currency,
  orderNumber,
  accessToken,
  successPayload,
  successSignature,
  failurePayload,
  failureSignature,
}: {
  intent: string
  amountCents: number
  currency: string
  orderNumber: string
  accessToken: string
  successPayload: string
  successSignature: string
  failurePayload: string
  failureSignature: string
}) {
  const [busy, setBusy] = useState<'pay' | 'fail' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  void intent

  async function settle(payload: string, signature: string, kind: 'pay' | 'fail') {
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch('/api/v1/webhooks/payments/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pq-signature': signature },
        body: payload,
      })
      if (!res.ok) {
        setError('The gateway could not be reached. Please try again.')
        setBusy(null)
        return
      }
      const suffix = kind === 'fail' ? '&payment=failed' : ''
      router.push(`/order-confirmation/${orderNumber}?k=${accessToken}${suffix}` as never)
    } catch {
      setError('Network hiccup — please try again.')
      setBusy(null)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-center font-display text-3xl font-bold">{formatMoney(amountCents, currency)}</p>
      <button
        className="btn-accent w-full !py-3.5"
        disabled={busy !== null}
        onClick={() => settle(successPayload, successSignature, 'pay')}
      >
        {busy === 'pay' ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <CheckCircle2 size={17} aria-hidden />}
        Pay now (sandbox)
      </button>
      <button
        className="btn-secondary w-full !py-3"
        disabled={busy !== null}
        onClick={() => settle(failurePayload, failureSignature, 'fail')}
      >
        {busy === 'fail' ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <XCircle size={16} aria-hidden />}
        Simulate a declined card
      </button>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
    </div>
  )
}
