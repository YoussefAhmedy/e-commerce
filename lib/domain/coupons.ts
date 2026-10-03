import type { Coupon } from '@/lib/db/types'

/**
 * Coupon validation — pure and deterministic so it is trivially testable.
 * All checks run server-side at cart-preview AND again at order creation.
 */

export interface CouponContext {
  subtotalCents: number
  userId: string | null
  userRedemptions: number
  totalRedemptions: number
  now: Date
}

export type CouponRejection =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'BELOW_MINIMUM'
  | 'USAGE_EXHAUSTED'
  | 'USER_LIMIT_REACHED'

export type CouponCheck =
  | { ok: true; coupon: Coupon }
  | { ok: false; reason: CouponRejection; message: string }

const messages: Record<CouponRejection, string> = {
  NOT_FOUND: 'This code is not recognized.',
  INACTIVE: 'This code is no longer active.',
  NOT_STARTED: 'This code is not active yet.',
  EXPIRED: 'This code has expired.',
  BELOW_MINIMUM: 'Your cart subtotal is below this code’s minimum.',
  USAGE_EXHAUSTED: 'This code has been fully redeemed.',
  USER_LIMIT_REACHED: 'You have already used this code.',
}

export function checkCoupon(coupon: Coupon | null, ctx: CouponContext): CouponCheck {
  const fail = (reason: CouponRejection): CouponCheck => ({ ok: false, reason, message: messages[reason] })
  if (!coupon) return fail('NOT_FOUND')
  if (!coupon.active) return fail('INACTIVE')
  if (coupon.startsAt && new Date(coupon.startsAt) > ctx.now) return fail('NOT_STARTED')
  if (coupon.endsAt && new Date(coupon.endsAt) < ctx.now) return fail('EXPIRED')
  if (coupon.maxRedemptions !== null && ctx.totalRedemptions >= coupon.maxRedemptions)
    return fail('USAGE_EXHAUSTED')
  if (ctx.userId && ctx.userRedemptions >= coupon.perUserLimit) return fail('USER_LIMIT_REACHED')
  if (ctx.subtotalCents < coupon.minSubtotalCents) return fail('BELOW_MINIMUM')
  return { ok: true, coupon }
}

/** Codes are compared case-insensitively, stored uppercase. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}
