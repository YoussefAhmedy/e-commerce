/**
 * Money is always integer cents. Never pass floats for price math.
 * All order math lives here so checkout/cart/admin can never disagree.
 */

export type Cents = number

export function formatMoney(cents: Cents, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/** Multiply with exact integer rounding (e.g. percentage discounts). */
export function mulPercent(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100)
}

/** Apply a fractional rate (tax). Rounds half away from zero per line. */
export function applyRate(cents: Cents, rate: number): Cents {
  return Math.round(cents * rate)
}

export function clampMinZero(cents: Cents): Cents {
  return cents < 0 ? 0 : cents
}

export const ZERO: Cents = 0
