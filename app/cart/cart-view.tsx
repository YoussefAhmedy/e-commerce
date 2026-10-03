'use client'

import { startTransition, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import type { CartSummary } from '@/lib/services/cart'
import { formatMoney } from '@/lib/utils/format'
import { EmptyState } from '@/components/ui/empty-state'

function emitCartChange() {
  window.dispatchEvent(new Event('pq:cart'))
}

export function CartView({ initial, couponQuery }: { initial: CartSummary; couponQuery: string }) {
  const [summary, setSummary] = useState(initial)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [coupon, setCoupon] = useState(couponQuery)
  const [appliedCoupon, setAppliedCoupon] = useState(couponQuery)
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const router = useRouter()

  async function mutateItem(itemId: string, body: { method: 'PATCH' | 'DELETE'; quantity?: number }) {
    setBusyItem(itemId)
    try {
      const res = await fetch(`/api/v1/cart/items/${itemId}`, {
        method: body.method,
        headers: { 'Content-Type': 'application/json' },
        body: body.method === 'PATCH' ? JSON.stringify({ itemId, quantity: body.quantity }) : undefined,
      })
      const json = await res.json()
      if (res.ok) {
        setSummary(json.data)
        emitCartChange()
      }
    } finally {
      setBusyItem(null)
    }
  }

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault()
    if (!coupon.trim()) return
    setCouponBusy(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/v1/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon }),
      })
      const json = await res.json()
      if (res.ok) {
        setSummary(json.data.summary)
        setAppliedCoupon(coupon.trim().toUpperCase())
        setCoupon('')
      } else {
        setCouponError(json?.error?.message ?? 'This code could not be applied.')
      }
    } finally {
      setCouponBusy(false)
    }
  }

  function removeCoupon() {
    setAppliedCoupon('')
    startTransition(() => {
      router.refresh()
      fetch('/api/v1/cart').then((r) => r.json()).then((json) => json?.ok && setSummary(json.data))
    })
  }

  const { totals } = summary
  const currency = 'USD'

  if (summary.cart.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        body="Browse the collection or design a custom print — anything you add will show up here, priced and saved on our side."
        action={{ href: '/catalog', label: 'Browse the collection' }}
      />
    )
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Cart <span className="text-lg font-normal text-ink-faint">({summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'})</span>
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        {/* Lines */}
        <ul className="space-y-4" aria-label="Cart items">
          {summary.cart.lines.map((line) => (
            <li key={line.id} className="card flex gap-4 p-4 sm:gap-5 sm:p-5">
              <Link href={`/products/${line.productSlug}` as never} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-cream">
                {line.imageUrl && (
                  <Image src={line.imageUrl} alt={line.productName} fill sizes="96px" className="object-cover" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/products/${line.productSlug}` as never} className="text-sm font-semibold text-ink hover:text-clay-700">
                      {line.productName}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-faint">{line.variantName}</p>
                    {line.customization?.uploadKey && <p className="mt-0.5 text-xs text-forest-600">✓ Your custom photo</p>}
                    {line.customization?.note && <p className="mt-0.5 text-xs italic text-ink-faint">“{line.customization.note}”</p>}
                    {line.availableStock <= 3 && line.availableStock > 0 && (
                      <p className="mt-1 text-xs font-medium text-amber-700">Only {line.availableStock} left</p>
                    )}
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold">{formatMoney(line.unitPriceCents * line.quantity, currency)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center rounded-full border border-line" role="group" aria-label={`Quantity for ${line.productName}`}>
                    <button
                      className="p-2 text-ink-soft hover:text-ink disabled:opacity-40"
                      aria-label="Decrease quantity"
                      disabled={busyItem === line.id || line.quantity <= 1}
                      onClick={() => mutateItem(line.id, { method: 'PATCH', quantity: line.quantity - 1 })}
                    >
                      <Minus size={13} aria-hidden />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      className="p-2 text-ink-soft hover:text-ink disabled:opacity-40"
                      aria-label="Increase quantity"
                      disabled={busyItem === line.id || line.quantity >= 10}
                      onClick={() => mutateItem(line.id, { method: 'PATCH', quantity: line.quantity + 1 })}
                    >
                      <Plus size={13} aria-hidden />
                    </button>
                  </div>
                  <button
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600"
                    onClick={() => mutateItem(line.id, { method: 'DELETE' })}
                    disabled={busyItem === line.id}
                    aria-label={`Remove ${line.productName} from cart`}
                  >
                    {busyItem === line.id ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Trash2 size={13} aria-hidden />}
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Summary */}
        <div className="card h-fit space-y-5 p-6 lg:sticky lg:top-32">
          <h2 className="font-display text-xl font-semibold">Summary</h2>

          {/* Coupon */}
          {summary.coupon ? (
            <div className="flex items-center justify-between rounded-xl bg-clay-50 px-4 py-3">
              <span className="text-sm font-semibold text-clay-700">{appliedCoupon || summary.coupon.code} applied</span>
              <button onClick={removeCoupon} className="rounded-full p-1 text-clay-700 hover:bg-clay-100" aria-label="Remove coupon">
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <form onSubmit={applyCoupon} className="space-y-2">
              <label htmlFor="coupon" className="label">Promo code</label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  className="field !py-2 uppercase"
                  placeholder="WELCOME10"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                />
                <button type="submit" className="btn-secondary !py-2 text-sm" disabled={couponBusy || !coupon.trim()}>
                  {couponBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : 'Apply'}
                </button>
              </div>
              {couponError && <p role="alert" className="text-xs text-red-600">{couponError}</p>}
            </form>
          )}

          <dl className="space-y-2.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="font-medium">{formatMoney(totals.subtotalCents, currency)}</dd></div>
            {totals.discountCents > 0 && (
              <div className="flex justify-between text-forest-600"><dt>Discount</dt><dd className="font-medium">−{formatMoney(totals.discountCents, currency)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd className="font-medium">{totals.shippingCents === 0 ? 'Free' : formatMoney(totals.shippingCents, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Estimated tax</dt><dd className="font-medium">{formatMoney(totals.taxCents, currency)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{formatMoney(totals.totalCents, currency)}</dd></div>
          </dl>

          {totals.shippingCents > 0 && (
            <p className="rounded-xl bg-cream px-4 py-2.5 text-xs text-ink-soft">
              Add {formatMoney(10000 - (totals.subtotalCents - totals.discountCents), currency)} more for free shipping
            </p>
          )}

          <Link href={'/checkout' as never} className="btn-accent w-full !py-3.5">
            Proceed to checkout
          </Link>
          <Link href={'/catalog' as never} className="btn-ghost w-full !py-2.5 text-sm">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
