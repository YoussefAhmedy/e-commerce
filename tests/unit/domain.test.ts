import { describe, it, expect } from 'vitest'
import {
  computeTotals, couponDiscountCents, priceLine, shippingCents, taxCents,
} from '@/lib/domain/pricing'
import { checkCoupon, normalizeCode } from '@/lib/domain/coupons'
import { canTransition, applyTransition, availableActions } from '@/lib/domain/order-fsm'
import { AppError } from '@/lib/domain/errors'
import type { Coupon } from '@/lib/db/types'
import { makeOrder } from '../helpers'

// ── pricing math ────────────────────────────────────────────────────────────

describe('pricing', () => {
  it('computes percent discounts against the pre-shipping subtotal', () => {
    const coupon = { code: 'WELCOME10', type: 'PERCENT', value: 10 } as Coupon
    expect(couponDiscountCents(coupon, 12000)).toBe(1200)
  })

  it('computes fixed discounts but never exceeds the subtotal', () => {
    const coupon = { code: 'FIVE', type: 'FIXED', value: 500 } as Coupon
    expect(couponDiscountCents(coupon, 12000)).toBe(500)
    expect(couponDiscountCents({ ...coupon, value: 99999 }, 300)).toBe(300)
  })

  it('free shipping kicks in at the threshold (after discount)', () => {
    expect(shippingCents(9999)).toBeGreaterThan(0)
    expect(shippingCents(10000)).toBe(0)
    expect(shippingCents(17496)).toBe(0)
  })

  it('tax rounds deterministically at 8%', () => {
    expect(taxCents(10800, 0.08)).toBe(864)
    expect(taxCents(101, 0.08)).toBe(8)
  })

  it('computeTotals matches hand-checked arithmetic', () => {
    const lines = [priceLine(8100, 2)] // 2× $81.00 → $162.00
    const totals = computeTotals(lines, null)
    // $162.00 subtotal ≥ $100 → free shipping; 8% tax = $12.96
    expect(totals).toEqual({
      subtotalCents: 16200,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 1296,
      totalCents: 17496,
    })
  })
})

// ── coupon rules ────────────────────────────────────────────────────────────

describe('coupons', () => {
  const base = {
    id: 'c1', code: 'WELCOME10', type: 'PERCENT', value: 10,
    minSubtotalCents: 0, startsAt: null, endsAt: null,
    maxRedemptions: null, perUserLimit: 1, active: true,
  } satisfies Coupon

  const ctx = { subtotalCents: 12000, userId: 'u1', userRedemptions: 0, totalRedemptions: 0, now: new Date() }

  it('normalizes codes', () => {
    expect(normalizeCode('  welcome10 ')).toBe('WELCOME10')
    expect(normalizeCode('A-B-C')).toBe('A-B-C')
  })

  it('accepts a valid coupon', () => {
    expect(checkCoupon(base, ctx)).toMatchObject({ ok: true })
  })

  it('rejects an expired coupon', () => {
    const r = checkCoupon({ ...base, endsAt: '2020-01-01T00:00:00Z' }, ctx)
    expect(r).toMatchObject({ ok: false, reason: 'EXPIRED' })
  })

  it('rejects before the start date', () => {
    const r = checkCoupon({ ...base, startsAt: '2999-01-01T00:00:00Z' }, ctx)
    expect(r.ok).toBe(false)
  })

  it('rejects below the minimum subtotal', () => {
    const r = checkCoupon({ ...base, minSubtotalCents: 20000 }, ctx)
    expect(r).toMatchObject({ ok: false, reason: 'BELOW_MINIMUM' })
  })

  it('rejects when the customer already hit the per-user limit', () => {
    const r = checkCoupon(base, { ...ctx, userRedemptions: 1 })
    expect(r).toMatchObject({ ok: false, reason: 'USER_LIMIT_REACHED' })
  })

  it('rejects exhausted campaigns', () => {
    const r = checkCoupon({ ...base, maxRedemptions: 3 }, { ...ctx, totalRedemptions: 3 })
    expect(r.ok).toBe(false)
  })

  it('rejects inactive coupons even when everything else is fine', () => {
    const r = checkCoupon({ ...base, active: false }, ctx)
    expect(r.ok).toBe(false)
  })
})

// ── order lifecycle FSM ─────────────────────────────────────────────────────

describe('order state machine', () => {
  it('allows the happy path: pending → paid → processing → shipped → delivered', () => {
    let o = makeOrder({})
    expect(availableActions(o)).toContain('MARK_PAID')
    o = makeOrder({ ...o, ...applyTransition(o, 'MARK_PAID') })
    expect(o.status).toBe('CONFIRMED')
    o = makeOrder({ ...o, ...applyTransition(o, 'START_PROCESSING') })
    o = makeOrder({ ...o, ...applyTransition(o, 'SHIP') })
    o = makeOrder({ ...o, ...applyTransition(o, 'DELIVER') })
    expect(o.fulfillmentStatus).toBe('DELIVERED')
    expect(availableActions(o)).toHaveLength(0)
  })

  it.each([
    ['SHIP', { status: 'PENDING' }],
    ['DELIVER', { status: 'CONFIRMED', paymentStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED' }],
    ['START_PROCESSING', { status: 'PENDING', paymentStatus: 'PENDING' }],
    ['REFUND', { status: 'PENDING', paymentStatus: 'PENDING' }],
    ['MARK_PAID', { status: 'CONFIRMED', paymentStatus: 'PAID' }],
  ] as const)('denies invalid transition %s', (action, state) => {
    const o = makeOrder(state as never)
    expect(canTransition(o, action)).toBe(false)
    expect(() => applyTransition(o, action)).toThrow(AppError)
  })

  it('denies cancelling after payment has been captured', () => {
    const o = makeOrder({ status: 'CONFIRMED', paymentStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED' })
    expect(canTransition(o, 'CANCEL')).toBe(false)
  })

  it('denies refund once delivered (requires an offline return process)', () => {
    const o = makeOrder({ status: 'CONFIRMED', paymentStatus: 'PAID', fulfillmentStatus: 'DELIVERED' })
    expect(canTransition(o, 'REFUND')).toBe(false)
  })
})
