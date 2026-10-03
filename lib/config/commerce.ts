import { env } from './env'

/** Commerce constants — all money in integer cents. Configurable per deployment via env. */
export const commerce = {
  get currency() {
    return env.CURRENCY
  },
  get taxRate() {
    return env.TAX_RATE
  },
  get shippingFlatCents() {
    return env.SHIPPING_FLAT_CENTS
  },
  get freeShippingThresholdCents() {
    return env.FREE_SHIPPING_THRESHOLD_CENTS
  },
  /** Standard poster build base price when a customer uploads their own art. */
  customPosterBasePriceCents: 2499,
  /** Session lifetime in seconds (30 days, rolled on activity). */
  sessionTtlSeconds: 60 * 60 * 24 * 30,
  /** Guest cart token lifetime (90 days). */
  guestCartTtlSeconds: 60 * 60 * 24 * 90,
  catalogPageSize: 12,
  maxUploadBytes: 8 * 1024 * 1024,
  allowedUploadMimes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const
