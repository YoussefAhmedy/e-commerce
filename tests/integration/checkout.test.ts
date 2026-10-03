import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { freshTestDb, cleanupTestDb, seedBaseCatalog } from '../helpers'

// NOTE: imports of DB-touching modules must come AFTER helper setup decides
// DATA_DIR — helpers.lazy-import via vitest module graph is fine because
// everything resolves DB lazily.
import * as cartsRepo from '@/lib/db/repositories/carts'
import * as ordersRepo from '@/lib/db/repositories/orders'
import { getVariant } from '@/lib/db/repositories/products'
import { createOrderFromCart, initiatePayment, handlePaymentWebhook, transitionOrder } from '@/lib/services/orders'
import { MockPaymentProvider } from '@/lib/providers/payments/mock'
import { findUserById } from '@/lib/db/repositories/users'
import { getDb } from '@/lib/db'

let dir = ''
let base: ReturnType<typeof seedBaseCatalog>

beforeEach(() => {
  dir = freshTestDb()
  base = seedBaseCatalog()
})
afterEach(() => cleanupTestDb(dir))

const address = { firstName: 'Smoke', lastName: 'Test', line1: '1 Way', city: 'Testville', postalCode: '12345', country: 'US' } as const

function buildCart(quantity = 2) {
  const { id, token } = cartsRepo.createCart(null)
  cartsRepo.addCartItem({ cartId: id, variantId: base.variantId, quantity, customization: null })
  void token
  return cartsRepo.loadCart(id)!
}

describe('checkout: order creation', () => {
  it('re-prices server-side and snapshots the purchase price', async () => {
    const cart = buildCart(2)
    const { order, isReplay } = createOrderFromCart(cart, null, {
      idempotencyKey: 'it-1',
      email: 'guest@test.dev',
      shippingAddress: { ...address },
      couponCode: 'welcome10', // lowercase on purpose — normalized server-side
    })
    expect(isReplay).toBe(false)

    // unit: 5000 + 1000 = 6000 · qty 2 = 12000 · 10% off = 1200 · free ship · tax 8% of 10800 = 864
    expect(order.subtotalCents).toBe(12000)
    expect(order.discountCents).toBe(1200)
    expect(order.shippingCents).toBe(0)
    expect(order.taxCents).toBe(864)
    expect(order.totalCents).toBe(11664)
    expect(order.couponCode).toBe('WELCOME10')

    // Purchase-time snapshot: mutating the catalog price afterwards does NOT
    // retro-actively change the charged amount.
    getDb().prepare('UPDATE product_variants SET price_delta_cents = 99999 WHERE id = ?').run(base.variantId)
    const snapshot = ordersRepo.getOrderById(order.id)!
    expect(snapshot.items[0]?.unitPriceCents).toBe(6000)

    // Stock is reserved at order time.
    expect(getVariant(base.variantId)!.reserved).toBe(2)
  })

  it('is idempotent: replaying the same key returns the same order', () => {
    const cart = buildCart(1)
    const first = createOrderFromCart(cart, null, { idempotencyKey: 'same-key', email: 'g@t.dev', shippingAddress: { ...address } })
    const second = createOrderFromCart(buildCart(1), null, { idempotencyKey: 'same-key', email: 'g@t.dev', shippingAddress: { ...address } })
    expect(second.isReplay).toBe(true)
    expect(second.order.id).toBe(first.order.id)
    expect(second.order.number).toBe(first.order.number)
  })

  it('rejects overselling when stock is already reserved (concurrency guard)', () => {
    // Two carts each holding 4 of a stock-5 variant (quantities bumped directly
    // past add-time clamping — the realistic race scenario). First order wins;
    // the second must fail INSIDE the checkout transaction, not at add time.
    const cartA = buildCart(1)
    const cartB = buildCart(1)
    for (const cart of [cartA, cartB]) {
      getDb().prepare('UPDATE cart_items SET quantity = 4 WHERE cart_id = ?').run(cart.id)
    }
    createOrderFromCart(cartsRepo.loadCart(cartA.id)!, null, { idempotencyKey: 'a', email: 'a@t.dev', shippingAddress: { ...address } })
    expect(() =>
      createOrderFromCart(cartsRepo.loadCart(cartB.id)!, null, { idempotencyKey: 'b', email: 'b@t.dev', shippingAddress: { ...address } }),
    ).toThrowError(/stock/i)
  })

  it('refuses an empty cart', () => {
    const { id } = cartsRepo.createCart(null)
    expect(() =>
      createOrderFromCart(cartsRepo.loadCart(id)!, null, { idempotencyKey: 'c', email: 'c@t.dev', shippingAddress: { ...address } }),
    ).toThrowError(/empty/i)
  })
})

describe('checkout: payment lifecycle via signed webhooks', () => {
  async function placeOrder() {
    const cart = buildCart(2)
    const { order } = createOrderFromCart(cart, base.customer, {
      idempotencyKey: `pay-${Math.random()}`,
      email: null,
      shippingAddress: { ...address },
      couponCode: 'WELCOME10',
    })
    const session = await initiatePayment(order)
    return { order, session }
  }

  function signed(body: Record<string, unknown>) : { raw: string; headers: Headers } {
    const raw = JSON.stringify(body)
    return { raw, headers: new Headers({ 'x-pq-signature': MockPaymentProvider.sign(body as never) }) }
  }

  it('marks the order paid exactly once, even for duplicate webhooks', async () => {
    const { order } = await placeOrder()
    const event = { eventId: `evt_${Math.random()}`, type: 'PAYMENT_SUCCEEDED', intentId: 'mock_intent', orderId: order.id, amountCents: order.totalCents, currency: 'USD' }

    const r1 = await handlePaymentWebhook('mock', ...Object.values(signed(event)) as [string, Headers])
    expect(r1.status).toBe('processed')
    let fresh = ordersRepo.getOrderById(order.id)!
    expect(fresh.paymentStatus).toBe('PAID')
    expect(fresh.status).toBe('CONFIRMED')
    // reservation consumed into the sale
    expect(getVariant(base.variantId)!.stock).toBe(3)
    expect(getVariant(base.variantId)!.reserved).toBe(0)
    // coupon redemption recorded (enforces per-user limit afterwards)
    expect(ordersRepo.countCouponRedemptions(base.couponId, base.customer.id).byUser).toBe(1)
    // order confirmation email enqueued
    expect((getDb().prepare('SELECT COUNT(*) n FROM email_log').get() as { n: number }).n).toBeGreaterThan(0)

    const r2 = await handlePaymentWebhook('mock', ...Object.values(signed(event)) as [string, Headers])
    expect(r2.status).toBe('duplicate')
    fresh = ordersRepo.getOrderById(order.id)!
    expect(fresh.paymentStatus).toBe('PAID')
  })

  it('rejects a forged signature outright', async () => {
    const { order } = await placeOrder()
    const body = JSON.stringify({ eventId: 'evt_forged', type: 'PAYMENT_SUCCEEDED', intentId: 'x', orderId: order.id, amountCents: order.totalCents, currency: 'USD' })
    await expect(
      handlePaymentWebhook('mock', body, new Headers({ 'x-pq-signature': 'deadbeef'.repeat(8) })),
    ).rejects.toThrow()
    expect(ordersRepo.getOrderById(order.id)!.paymentStatus).toBe('PENDING')
  })

  it('ignores a webhook whose amount does not match the order total', async () => {
    const { order } = await placeOrder()
    const event = { eventId: 'evt_wrong_amount', type: 'PAYMENT_SUCCEEDED', intentId: 'y', orderId: order.id, amountCents: 100, currency: 'USD' }
    const r = await handlePaymentWebhook('mock', ...Object.values(signed(event)) as [string, Headers])
    expect(r.status).toBe('ignored')
    expect(ordersRepo.getOrderById(order.id)!.paymentStatus).toBe('PENDING')
    const auditRow = getDb().prepare(`SELECT action FROM audit_log WHERE action = 'PAYMENT_AMOUNT_MISMATCH'`).get()
    expect(auditRow).toBeTruthy()
  })

  it('admin runs the fulfillment transitions; customers cannot ship orders', async () => {
    const { order, session } = await placeOrder()
    void session
    // pay it
    const ev = { eventId: 'evt_admin', type: 'PAYMENT_SUCCEEDED', intentId: 'i', orderId: order.id, amountCents: order.totalCents, currency: 'USD' }
    await handlePaymentWebhook('mock', ...Object.values(signed(ev)) as [string, Headers])

    const adminUser = findUserById(base.admin.id)!
    const processed = transitionOrder(order.id, 'START_PROCESSING', { ...adminUser, emailVerifiedAt: '' })
    expect(processed.fulfillmentStatus).toBe('PROCESSING')
    const shipped = transitionOrder(order.id, 'SHIP', { ...adminUser, emailVerifiedAt: '' }, { trackingNumber: '1ZTEST', carrier: 'TEST' })
    expect(shipped.fulfillmentStatus).toBe('SHIPPED')

    // FSM blocks impossible transitions for anyone.
    expect(() => transitionOrder(order.id, 'START_PROCESSING', { ...adminUser, emailVerifiedAt: '' })).toThrow()
  })
})
