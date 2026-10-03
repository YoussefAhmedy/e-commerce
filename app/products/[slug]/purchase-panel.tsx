'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Minus, Plus, Truck } from 'lucide-react'
import type { Product } from '@/lib/db/types'
import { Price } from '@/components/ui/price'
import { Stars } from '@/components/ui/stars'
import { formatMoney } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { WishlistButton } from '@/components/storefront/wishlist-button'

/**
 * Purchase panel: variant selection with live server-priced display,
 * quantity, Add to Cart / Buy Now. Prices shown come from server data —
 * final totals are re-computed server-side at checkout anyway.
 */
export function PurchasePanel({ product }: { product: Product }) {
  const router = useRouter()
  const sorted = useMemo(
    () => [...product.variants].sort((a, b) => a.priceDeltaCents - b.priceDeltaCents),
    [product.variants],
  )
  const [variantId, setVariantId] = useState(sorted[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState<'idle' | 'cart' | 'buy'>('idle')
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const variant = sorted.find((v) => v.id === variantId) ?? sorted[0]
  const unitPrice = product.basePriceCents + (variant?.priceDeltaCents ?? 0)
  const inStock = (variant?.stock ?? 0) - (variant?.reserved ?? 0) > 0
  const lowStock = inStock && (variant?.stock ?? 0) - (variant?.reserved ?? 0) <= 3

  async function addToCart(then: 'stay' | 'checkout') {
    if (!variant || !inStock) return
    setBusy(then === 'stay' ? 'cart' : 'buy')
    setError(null)
    try {
      const res = await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variant.id, quantity }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not add to cart. Please try again.')
        return
      }
      window.dispatchEvent(new Event('pq:cart'))
      if (then === 'checkout') {
        router.push('/checkout')
      } else {
        setAdded(true)
        setTimeout(() => setAdded(false), 2200)
      }
    } catch {
      setError('Network hiccup — please try again.')
    } finally {
      setBusy('idle')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-ink-faint">
        {product.categoryName && <span>{product.categoryName}</span>}
        {product.ratingCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <Stars rating={product.ratingAvg} count={product.ratingCount} />
          </>
        )}
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{product.name}</h1>
        <WishlistButton productId={product.id} />
      </div>

      <p className="mt-3 text-base leading-relaxed text-ink-soft">{product.summary}</p>

      <div className="mt-5">
        {sorted.length > 1 && <span className="text-sm text-ink-faint">from </span>}
        <Price
          cents={unitPrice}
          currency={product.currency}
          compareAtCents={product.compareAtCents}
          className="[&>span:first-child]:text-3xl"
        />
        {product.compareAtCents != null && product.compareAtCents > unitPrice && (
          <span className="ml-2 rounded-full bg-clay-50 px-2.5 py-1 text-xs font-bold text-clay-700">
            Save {Math.round(((product.compareAtCents - unitPrice) / product.compareAtCents) * 100)}%
          </span>
        )}
      </div>

      {/* Variant selector */}
      {sorted.length > 0 && (
        <fieldset className="mt-7">
          <legend className="label !mb-3">{product.type === 'POSTER' ? 'Size' : 'Option'}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sorted.map((v) => {
              const out = v.stock - v.reserved <= 0
              const selected = v.id === variant?.id
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  onClick={() => setVariantId(v.id)}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition-all',
                    selected ? 'border-clay-600 bg-clay-50 ring-1 ring-clay-600' : 'border-line bg-white hover:border-ink-faint',
                    out && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="block text-sm font-medium">{v.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {out ? 'Sold out' : formatMoney(product.basePriceCents + v.priceDeltaCents, product.currency)}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Stock signal */}
      <p className={cn('mt-4 text-sm font-medium', inStock ? (lowStock ? 'text-amber-700' : 'text-forest-600') : 'text-red-600')} role="status">
        {inStock ? (lowStock ? 'Low stock — order soon' : 'In stock · made to order') : 'Currently sold out'}
      </p>

      {/* Quantity + actions */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-white" role="group" aria-label="Quantity">
          <button
            className="p-2.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            <Minus size={15} aria-hidden />
          </button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
          <button
            className="p-2.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            disabled={quantity >= 10}
            aria-label="Increase quantity"
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>
        <p className="text-sm text-ink-faint">
          Total <span className="font-semibold text-ink">{formatMoney(unitPrice * quantity, product.currency)}</span>
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          className="btn-secondary !py-3.5"
          disabled={!inStock || busy !== 'idle'}
          onClick={() => addToCart('stay')}
        >
          {busy === 'cart' ? (
            <Loader2 size={17} className="animate-spin" aria-hidden />
          ) : added ? (
            <Check size={17} className="text-forest-600" aria-hidden />
          ) : null}
          {added ? 'Added to cart' : 'Add to cart'}
        </button>
        <button
          className="btn-accent !py-3.5"
          disabled={!inStock || busy !== 'idle'}
          onClick={() => addToCart('checkout')}
        >
          {busy === 'buy' && <Loader2 size={17} className="animate-spin" aria-hidden />}
          Buy now
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
        <Truck size={16} aria-hidden /> Free shipping over $100 · arrives in 5–9 days, tracked
      </p>
    </div>
  )
}
