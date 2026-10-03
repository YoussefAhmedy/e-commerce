import { cookies } from 'next/headers'
import { AppError } from '@/lib/domain/errors'
import { withTransaction } from '@/lib/db'
import * as carts from '@/lib/db/repositories/carts'
import { getVariant, getProductById } from '@/lib/db/repositories/products'
import type { Cart, CartCustomization } from '@/lib/db/types'
import { getSessionUser, getGuestCartToken, setGuestCartToken, GUEST_CART_COOKIE } from '@/lib/security/session'
import { computeTotals, priceLine, type OrderTotals } from '@/lib/domain/pricing'
import { checkCoupon, normalizeCode } from '@/lib/domain/coupons'
import { countCouponRedemptions, findCouponByCode } from '@/lib/db/repositories/orders'
import { trackEvent, getUpload } from '@/lib/db/repositories/engagement'

/**
 * Cart service — guests and signed-in users share ONE flow:
 * a server cart identified by an httpOnly bearer cookie. On login,
 * the guest cart merges into the user cart.
 */

export async function resolveCart(): Promise<{ cart: Cart; freshToken: string | null }> {
  const user = await getSessionUser()

  // Signed-in users: their account cart wins.
  if (user) {
    const owned = carts.findActiveCartByUser(user.id)
    if (owned) {
      const cart = carts.loadCart(owned.id)
      if (cart) return { cart, freshToken: null }
    }
    // Adopt the guest cart from the cookie if one is around.
    const guestToken = await getGuestCartToken()
    if (guestToken) {
      const guest = carts.findActiveCartByToken(guestToken)
      if (guest) {
        carts.attachCartToUser(guest.id, user.id)
        const cart = carts.loadCart(guest.id)
        if (cart) return { cart, freshToken: null }
      }
    }
    const created = carts.createCart(user.id)
    const cart = carts.loadCart(created.id)!
    return { cart, freshToken: created.token }
  }

  // Guests: cookie-token cart or a fresh one.
  const token = await getGuestCartToken()
  if (token) {
    const found = carts.findActiveCartByToken(token)
    if (found) {
      const cart = carts.loadCart(found.id)
      if (cart) return { cart, freshToken: null }
    }
  }
  const created = carts.createCart(null)
  const cart = carts.loadCart(created.id)!
  return { cart, freshToken: created.token }
}

/** Mutations call this then persist freshToken as the cookie when set. */
export async function persistCartCookie(freshToken: string | null): Promise<void> {
  if (freshToken) await setGuestCartToken(freshToken)
}

/** On login/register: fold the guest cart into the account cart. */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const guestToken = await getGuestCartToken()
  if (!guestToken) return
  const guest = carts.findActiveCartByToken(guestToken)
  if (!guest || guest.userId === userId) return
  const userCart = carts.findActiveCartByUser(userId) ?? carts.createCart(userId)
  withTransaction(() => {
    carts.mergeCarts(guest.id, userCart.id, userId)
  })
}

export interface CartSummary {
  cart: Cart
  totals: OrderTotals
  coupon: { code: string; discountCents: number } | null
  itemCount: number
}

export function summarizeCart(cart: Cart, couponCode?: string | null, userId?: string | null): CartSummary {
  const lines = cart.lines.map((l) => priceLine(l.unitPriceCents, l.quantity))
  let coupon = null as null | { code: string; discountCents: number }
  let couponRow = null
  if (couponCode) {
    const candidate = findCouponByCode(normalizeCode(couponCode))
    if (candidate) {
      const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0)
      const counts = countCouponRedemptions(candidate.id, userId ?? null)
      const check = checkCoupon(candidate, {
        subtotalCents: subtotal,
        userId: userId ?? null,
        userRedemptions: counts.byUser,
        totalRedemptions: counts.total,
        now: new Date(),
      })
      if (check.ok) couponRow = check.coupon
    }
  }
  const totals = computeTotals(lines, couponRow)
  if (couponRow && totals.discountCents > 0) {
    coupon = { code: couponRow.code, discountCents: totals.discountCents }
  }
  return {
    cart,
    totals,
    coupon,
    itemCount: cart.lines.reduce((n, l) => n + l.quantity, 0),
  }
}

export async function addLine(input: {
  variantId: string
  quantity: number
  customization: CartCustomization | null
}): Promise<{ cart: Cart; freshToken: string | null }> {
  // Resolve catalog-side facts server-side — the client sends ids only.
  const variant = getVariant(input.variantId)
  if (!variant || !variant.active) throw new AppError('NOT_FOUND', 'That option is no longer available.')
  const product = getProductById(variant.productId)
  if (!product || product.status !== 'PUBLISHED') throw new AppError('NOT_FOUND', 'That product is no longer available.')
  const availability = variant.stock - variant.reserved
  if (availability <= 0) throw new AppError('INSUFFICIENT_STOCK', `${product.name} (${variant.name}) is out of stock right now.`)

  if (input.customization?.frameVariantId) {
    const fv = getVariant(input.customization.frameVariantId)
    if (!fv || !fv.active) throw new AppError('VALIDATION', 'The selected frame is no longer available.')
  }

  // Custom uploads: resolve the storage key server-side (the client never
  // supplies media paths) and drop customization if nothing meaningful remains.
  let customization = input.customization
  if (customization?.uploadId) {
    const upload = getUpload(customization.uploadId)
    if (!upload) throw new AppError('VALIDATION', 'The uploaded image could not be found. Please re-upload it.')
    customization = { ...customization, uploadKey: upload.storageKey }
  } else if (customization && !customization.frameVariantId && !customization.note) {
    customization = null
  }

  const { cart, freshToken } = await resolveCart()
  carts.addCartItem({
    cartId: cart.id,
    variantId: input.variantId,
    quantity: input.quantity,
    customization,
  })
  trackEvent('ADD_TO_CART', { productId: product.id, userId: cart.userId ?? undefined })

  const fresh = carts.loadCart(cart.id)!
  return { cart: fresh, freshToken }
}

export async function setLineQuantity(itemId: string, quantity: number): Promise<Cart> {
  const { cart } = await resolveCart()
  if (!carts.cartItemBelongsToCart(itemId, cart.id)) {
    throw new AppError('NOT_FOUND', 'Cart item not found.')
  }
  carts.updateCartItemQuantity(itemId, quantity)
  return carts.loadCart(cart.id)!
}

export async function removeLine(itemId: string): Promise<Cart> {
  const { cart } = await resolveCart()
  if (!carts.cartItemBelongsToCart(itemId, cart.id)) {
    throw new AppError('NOT_FOUND', 'Cart item not found.')
  }
  carts.removeCartItem(itemId)
  return carts.loadCart(cart.id)!
}

export { GUEST_CART_COOKIE }
