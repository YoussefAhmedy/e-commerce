import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb, getDb, migrate, newId } from '@/lib/db'
import { resetEnvForTests } from '@/lib/config/env'
import { createProduct, upsertCategory, getProductById } from '@/lib/db/repositories/products'
import { createUser } from '@/lib/db/repositories/users'
import { upsertCoupon } from '@/lib/db/repositories/orders'
import type { Cart, Order, PublicUser } from '@/lib/db/types'
import type { DUMMY_HASH } from '@/lib/security/passwords'

/**
 * Per-suite isolated SQLite database: a fresh tmpdir as DATA_DIR, env cache
 * reset, DB singleton closed so it lazily reopens against the new path.
 * Call from beforeEach in integration suites.
 */
export function freshTestDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'printique-test-'))
  process.env.DATA_DIR = dir
  resetEnvForTests()
  closeDb()
  migrate()
  return dir
}

export function cleanupTestDb(dir: string): void {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
}

/** Minimal domain state: one category, one poster (1 variant), one coupon, one verified customer. */
export function seedBaseCatalog(): {
  admin: PublicUser & { passwordHash?: string }
  customer: PublicUser
  productId: string
  variantId: string
  couponId: string
} {
  const cat = upsertCategory({ id: newId(), slug: 'abstract', name: 'Abstract', description: null, imageUrl: null, position: 0 })
  const product = createProduct({
    slug: 'test-print',
    name: 'Test Print',
    summary: 'For tests',
    description: 'Test product',
    categoryId: cat.id,
    type: 'POSTER',
    status: 'PUBLISHED',
    basePriceCents: 5000,
    compareAtCents: null,
    currency: 'USD',
    tags: ['test'],
    attributes: {},
    featured: false,
    seoTitle: null,
    seoDescription: null,
    images: [],
    variants: [{ sku: 'TEST_A4', name: 'A4', options: { size: '21x30' }, priceDeltaCents: 1000, stock: 5, active: true }],
  })
  const coupon = upsertCoupon({
    id: newId(),
    code: 'WELCOME10',
    type: 'PERCENT',
    value: 10,
    minSubtotalCents: 0,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    perUserLimit: 1,
    active: true,
  })
  const admin = createUser({ email: 'admin@test.dev', name: 'Admin', passwordHash: 'x', role: 'ADMIN', emailVerified: true })
  const customer = createUser({ email: 'cust@test.dev', name: 'Customer', passwordHash: 'x', emailVerified: true })
  return {
    admin: admin as never,
    customer,
    productId: product.id,
    variantId: product.variants[0]!.id,
    couponId: coupon.id,
  }
}

export function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'order-1',
    number: 'PRT-TEST01',
    userId: null,
    guestEmail: null,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    fulfillmentStatus: 'UNFULFILLED',
    currency: 'USD',
    subtotalCents: 12000,
    discountCents: 0,
    taxCents: 0,
    shippingCents: 0,
    totalCents: 12000,
    couponId: null,
    couponCode: null,
    shippingAddress: { firstName: 'A', lastName: 'B', line1: '1 St', city: 'X', postalCode: '1', country: 'US' },
    shippingMethod: 'STANDARD',
    trackingNumber: null,
    carrier: null,
    idempotencyKey: 'k1',
    placedAt: new Date().toISOString(),
    items: [],
    ...overrides,
  }
}
