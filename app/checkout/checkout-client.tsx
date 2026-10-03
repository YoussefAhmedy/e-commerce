'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, CreditCard, Loader2, Lock } from 'lucide-react'
import type { CartSummary } from '@/lib/services/cart'
import type { AddressInput } from '@/lib/db/types'
import { formatMoney } from '@/lib/utils/format'
import { emitCartChange } from '@/lib/utils/events'
import { cn } from '@/lib/utils/cn'

type Step = 'details' | 'review' | 'processing'

const FIELD_LIMITS = {
  firstName: 60, lastName: 60, line1: 120, line2: 120, city: 80, state: 80,
  postalCode: 20, country: 2, phone: 30,
} as const

/**
 * Streamlined checkout: (1) contact + shipping → (2) review & pay.
 * The client NEVER computes totals and NEVER sees card data — payment
 * happens on the provider's hosted page (mock in dev, Stripe in prod).
 */
export function CheckoutClient({
  initialSummary,
  initialEmail,
  initialAddress,
  isAuthenticated,
}: {
  initialSummary: CartSummary
  initialEmail: string
  initialAddress: AddressInput | null
  isAuthenticated: boolean
}) {
  const [step, setStep] = useState<Step>('details')
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState(initialEmail)
  const [address, setAddress] = useState<AddressInput>({
    firstName: '', lastName: '', line1: '', line2: '', city: '',
    state: '', postalCode: '', country: 'US', phone: '',
    ...(initialAddress ?? {}),
  } as AddressInput)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [coupon] = useState<string>('')
  const router = useRouter()
  // Idempotency key for the order commit: generated once per checkout session.
  const idempotencyKey = useRef<string>(crypto.randomUUID())

  const summary = initialSummary
  const currency = 'USD'
  const couponFromUrl = useMemo(() => {
    // The cart page forwards an applied coupon in the URL; read it once.
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('coupon') ?? ''
  }, [])

  function set(field: keyof AddressInput) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddress((a) => ({ ...a, [field]: e.target.value }))
  }

  const detailsValid =
    address.firstName.trim().length > 0 &&
    address.lastName.trim().length > 0 &&
    address.line1.trim().length >= 2 &&
    address.city.trim().length > 0 &&
    address.postalCode.trim().length >= 2 &&
    address.country.trim().length === 2 &&
    (isAuthenticated || /.+@.+\..+/.test(email))

  async function placeOrder() {
    setStep('processing')
    setError(null)
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          email: isAuthenticated ? undefined : email,
          shippingAddress: address,
          couponCode: couponFromUrl || coupon || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'We could not place your order. Nothing was charged — please try again.')
        if (json?.error?.details && typeof json.error.details === 'object') {
          setFieldErrors(json.error.details as Record<string, string>)
        }
        setStep('review')
        return
      }
      emitCartChange()
      const { order, payment, accessToken } = json.data
      if (payment?.checkoutUrl) {
        router.push(`${payment.checkoutUrl}?k=${accessToken}` as never)
      } else if (payment?.clientSecret) {
        // Stripe path: the hosted Payment Element mounts here in production.
        // See docs/payments.md — confirmation still only lands via webhook.
        router.push(`/order-confirmation/${order.number}?k=${accessToken}&awaiting=stripe` as never)
      } else {
        router.push(`/order-confirmation/${order.number}?k=${accessToken}` as never)
      }
    } catch {
      setError('Network hiccup — please try again. Nothing was charged.')
      setStep('review')
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
      <div>
        {/* Step indicator */}
        <nav aria-label="Checkout steps" className="mb-8">
          <ol className="flex items-center gap-3 text-sm">
            {(['details', 'review'] as const).map((s, i) => {
              const done = (step === 'review' || step === 'processing') && s === 'details'
              const activeNow = (step === 'details' && s === 'details') || ((step === 'review' || step === 'processing') && s === 'review')
              return (
                <li key={s} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                      done ? 'bg-forest-600 text-white' : activeNow ? 'bg-ink text-paper' : 'bg-cream text-ink-faint',
                    )}
                    aria-hidden
                  >
                    {done ? <Check size={13} /> : i + 1}
                  </span>
                  <span className={cn('font-medium capitalize', activeNow ? 'text-ink' : 'text-ink-faint')}>
                    {s === 'details' ? 'Shipping' : 'Review & pay'}
                  </span>
                  {i === 0 && <span className="h-px w-10 bg-line" aria-hidden />}
                </li>
              )
            })}
          </ol>
        </nav>

        {step === 'details' && (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (detailsValid) setStep('review')
            }}
          >
            {!isAuthenticated && (
              <div>
                <label className="label" htmlFor="email">Email for order updates</label>
                <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                <p className="mt-1.5 text-xs text-ink-faint">
                  Have an account? <a href="/signin?next=/checkout" className="font-medium text-clay-700">Sign in</a> for a faster checkout.
                </p>
              </div>
            )}

            <fieldset>
              <legend className="sr-only">Shipping address</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="firstName">First name</label>
                  <input id="firstName" required maxLength={FIELD_LIMITS.firstName} className="field" value={address.firstName} onChange={set('firstName')} autoComplete="given-name" />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">Last name</label>
                  <input id="lastName" required maxLength={FIELD_LIMITS.lastName} className="field" value={address.lastName} onChange={set('lastName')} autoComplete="family-name" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="line1">Street address</label>
                  <input id="line1" required maxLength={FIELD_LIMITS.line1} className="field" value={address.line1} onChange={set('line1')} autoComplete="address-line1" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="line2">Apartment, suite… (optional)</label>
                  <input id="line2" maxLength={FIELD_LIMITS.line2} className="field" value={address.line2 ?? ''} onChange={set('line2')} autoComplete="address-line2" />
                </div>
                <div>
                  <label className="label" htmlFor="city">City</label>
                  <input id="city" required maxLength={FIELD_LIMITS.city} className="field" value={address.city} onChange={set('city')} autoComplete="address-level2" />
                </div>
                <div>
                  <label className="label" htmlFor="state">State / region</label>
                  <input id="state" maxLength={FIELD_LIMITS.state} className="field" value={address.state ?? ''} onChange={set('state')} autoComplete="address-level1" />
                </div>
                <div>
                  <label className="label" htmlFor="postalCode">Postal code</label>
                  <input id="postalCode" required maxLength={FIELD_LIMITS.postalCode} className={cn('field', fieldErrors.shippingAddress && 'field-error')} value={address.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
                </div>
                <div>
                  <label className="label" htmlFor="country">Country</label>
                  <select id="country" required className="field" value={address.country} onChange={set('country')} autoComplete="country">
                    {['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'AU', 'EG', 'AE'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="phone">Phone (optional, for the carrier)</label>
                  <input id="phone" type="tel" maxLength={FIELD_LIMITS.phone} className="field" value={address.phone ?? ''} onChange={set('phone')} autoComplete="tel" />
                </div>
              </div>
            </fieldset>

            <button type="submit" className="btn-primary w-full !py-3.5" disabled={!detailsValid}>
              Review order
            </button>
          </form>
        )}

        {(step === 'review' || step === 'processing') && (
          <div className="space-y-6">
            {step === 'review' && (
              <button className="btn-ghost -ml-3 text-sm" onClick={() => setStep('details')}>
                <ArrowLeft size={15} aria-hidden /> Edit shipping details
              </button>
            )}

            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-soft">Ship to</h2>
              <p className="mt-2 text-sm leading-relaxed">
                {address.firstName} {address.lastName}<br />
                {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
                {address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}, {address.country}
              </p>
              {!isAuthenticated && <p className="mt-1 text-sm text-ink-soft">{email}</p>}
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              className="btn-accent w-full !py-4 text-base"
              onClick={placeOrder}
              disabled={step === 'processing'}
            >
              {step === 'processing' ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden />
                  Placing your order…
                </>
              ) : (
                <>
                  <Lock size={15} aria-hidden />
                  Pay {formatMoney(summary.totals.totalCents, currency)}
                </>
              )}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint">
              <CreditCard size={13} aria-hidden />
              Payment is handled by our secure provider — your card details never touch our servers.
            </p>
          </div>
        )}
      </div>

      {/* Summary rail */}
      <aside className="h-fit space-y-5 lg:sticky lg:top-32">
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold">Your order</h2>
          <ul className="mt-4 space-y-3">
            {summary.cart.lines.map((line) => (
              <li key={line.id} className="flex gap-3">
                <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">
                  {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{line.productName}</span>
                  <span className="text-xs text-ink-faint">{line.variantName} × {line.quantity}</span>
                </span>
                <span className="text-sm font-medium">{formatMoney(line.unitPriceCents * line.quantity, currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatMoney(summary.totals.subtotalCents, currency)}</dd></div>
            {summary.totals.discountCents > 0 && (
              <div className="flex justify-between text-forest-600"><dt>Discount</dt><dd>−{formatMoney(summary.totals.discountCents, currency)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd>{summary.totals.shippingCents === 0 ? 'Free' : formatMoney(summary.totals.shippingCents, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Tax</dt><dd>{formatMoney(summary.totals.taxCents, currency)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{formatMoney(summary.totals.totalCents, currency)}</dd></div>
          </dl>
        </div>
      </aside>
    </div>
  )
}
