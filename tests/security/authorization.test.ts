import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { freshTestDb, cleanupTestDb, seedBaseCatalog } from '../helpers'
import * as cartsRepo from '@/lib/db/repositories/carts'
import * as ordersRepo from '@/lib/db/repositories/orders'
import { createUser } from '@/lib/db/repositories/users'
import { createOrderFromCart, cancelOwnOrder, canViewOrder, orderAccessToken } from '@/lib/services/orders'
import { AppError } from '@/lib/domain/errors'

let dir = ''
let base: ReturnType<typeof seedBaseCatalog>
beforeEach(() => { dir = freshTestDb(); base = seedBaseCatalog() })
afterEach(() => cleanupTestDb(dir))

const address = { firstName: 'I', lastName: 'Dor', line1: '1 Way', city: 'Testville', postalCode: '12345', country: 'US' } as const

function orderFor(userId: string) {
  const user = { ...base.customer, id: userId }
  const { id } = cartsRepo.createCart(userId)
  cartsRepo.addCartItem({ cartId: id, variantId: base.variantId, quantity: 1, customization: null })
  return createOrderFromCart(cartsRepo.loadCart(id)!, user, {
    idempotencyKey: `idor-${userId}`,
    email: null,
    shippingAddress: { ...address },
  }).order
}

describe('IDOR — customers can never touch other customers’ orders', () => {
  it('canViewOrder isolates: owner=yes, stranger=no, token-bearer=yes (guest flow)', () => {
    const stranger = createUser({ email: 'stranger@test.dev', name: 'Stranger', passwordHash: 'x', emailVerified: true })
    const order = orderFor(base.customer.id)

    expect(canViewOrder(order, { ...base.customer })).toBe(true)
    expect(canViewOrder(order, { ...stranger })).toBe(false)
    expect(canViewOrder(order, null)).toBe(false)
    // order confirmation links are HMAC-signed bearer tokens
    expect(canViewOrder(order, null, orderAccessToken(order.id))).toBe(true)
    expect(canViewOrder(order, null, 'forged-token')).toBe(false)
    // admins may view for support/moderation
    expect(canViewOrder(order, { ...base.admin })).toBe(true)
  })

  it('cancelOwnOrder rejects cross-user cancellation', () => {
    const stranger = createUser({ email: 'mallory@test.dev', name: 'Mallory', passwordHash: 'x', emailVerified: true })
    const order = orderFor(base.customer.id)
    expect(() => cancelOwnOrder(order.id, { ...stranger })).toThrow(AppError)
    expect(ordersRepo.getOrderById(order.id)!.status).toBe('PENDING') // untouched
  })

  it('guest orders are invisible to signed-in strangers (scoped by email/token only)', () => {
    const { id } = cartsRepo.createCart(null)
    cartsRepo.addCartItem({ cartId: id, variantId: base.variantId, quantity: 1, customization: null })
    const guest = createOrderFromCart(cartsRepo.loadCart(id)!, null, {
      idempotencyKey: 'guest-1',
      email: 'guest@shopper.dev',
      shippingAddress: { ...address },
    }).order

    const stranger = createUser({ email: 'guest@shopper.dev', name: 'Same-email Stranger', passwordHash: 'x', emailVerified: true })
    // Same email + distinct account: still NOT visible without the access token.
    expect(canViewOrder(guest, { ...stranger })).toBe(false)
    expect(canViewOrder(guest, null, orderAccessToken(guest.id))).toBe(true)
  })
})

describe('negative: price manipulation surface', () => {
  it('cart quantities are the ONLY client-controlled pricing input — totals cannot be injected', () => {
    const { id } = cartsRepo.createCart(null)
    cartsRepo.addCartItem({ cartId: id, variantId: base.variantId, quantity: 2, customization: null })
    const cart = cartsRepo.loadCart(id)!
    // The checkout request body has no price/total fields at all (zod strips
    // unknown keys); the order total is recomputed from server-side lines.
    const { order } = createOrderFromCart(cart, null, {
      idempotencyKey: 'tamper-1',
      email: 't@t.dev',
      shippingAddress: { ...address },
      clientTotalCents: 1,
      paymentSuccess: true,
    } as never)
    // 2 × $60.00 = $120.00; free shipping (≥ $100); 8% tax = $9.60 → $129.60.
    expect(order.totalCents).toBe(12960)
    expect(order.paymentStatus).toBe('PENDING') // smuggled paymentSuccess did nothing
  })
})
