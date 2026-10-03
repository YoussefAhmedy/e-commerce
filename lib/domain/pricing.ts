import { commerce } from '@/lib/config/commerce'
import { applyRate, clampMinZero, mulPercent, type Cents } from './money'
import type { CartCustomization, Coupon, Product, ProductVariant } from '@/lib/db/types'

/**
 * Pricing — pure functions, used by cart re-pricing, checkout, order
 * creation and the admin preview. The browser NEVER decides prices.
 */

/** Unit price for a standard product variant. */
export function variantUnitPriceCents(product: Product, variant: ProductVariant): Cents {
  return product.basePriceCents + variant.priceDeltaCents
}

export interface PricedLine {
  unitPriceCents: Cents
  quantity: number
  lineTotalCents: Cents
}

/**
 * Unit price for a cart line: the chosen variant's price, plus the frame
 * variant for custom-upload builds. Both sides are resolved server-side
 * from the database — client-supplied prices are ignored entirely.
 */
export function cartLineUnitPriceCents(input: {
  product: Product
  variant: ProductVariant
  customization: CartCustomization | null
  frame?: { product: Product; variant: ProductVariant } | null
}): Cents {
  let unit = variantUnitPriceCents(input.product, input.variant)
  if (input.customization?.frameVariantId && input.frame) {
    unit += variantUnitPriceCents(input.frame.product, input.frame.variant)
  }
  return unit
}

export function priceLine(unitPriceCents: Cents, quantity: number): PricedLine {
  return {
    unitPriceCents,
    quantity,
    lineTotalCents: unitPriceCents * quantity,
  }
}

/** Coupon outcome — shared by /api/coupons/validate and order creation. */
export function couponDiscountCents(coupon: Coupon, subtotalCents: Cents): Cents {
  if (coupon.type === 'PERCENT') {
    return clampMinZero(mulPercent(subtotalCents, coupon.value))
  }
  return clampMinZero(Math.min(coupon.value, subtotalCents))
}

export function shippingCents(subtotalAfterDiscountCents: Cents): Cents {
  return subtotalAfterDiscountCents >= commerce.freeShippingThresholdCents
    ? 0
    : commerce.shippingFlatCents
}

export function taxCents(taxableSubtotalCents: Cents, rate = commerce.taxRate): Cents {
  return applyRate(taxableSubtotalCents, rate)
}

export interface OrderTotals {
  subtotalCents: Cents
  discountCents: Cents
  shippingCents: Cents
  taxCents: Cents
  totalCents: Cents
}

/**
 * The single source of truth for order math:
 *   tax is applied to (subtotal − discount); shipping is flat/free over threshold.
 */
export function computeTotals(lines: PricedLine[], coupon: Coupon | null): OrderTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const discountCents = coupon ? couponDiscountCents(coupon, subtotalCents) : 0
  const discounted = clampMinZero(subtotalCents - discountCents)
  const shipping = shippingCents(discounted)
  const tax = taxCents(discounted)
  return {
    subtotalCents,
    discountCents,
    shippingCents: discounted === 0 ? 0 : shipping,
    taxCents: tax,
    totalCents: discounted + (discounted === 0 ? 0 : shipping) + tax,
  }
}
