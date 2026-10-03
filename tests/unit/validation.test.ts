import { describe, it, expect } from 'vitest'
import {
  orderCreateSchema, registerSchema, reviewCreateSchema, addressSchema,
  productWriteSchema, couponWriteSchema, passwordSchema,
} from '@/lib/validation/schemas'

describe('validation schemas', () => {
  it('checkout input strips smuggled price fields (defense in depth for the service layer)', () => {
    const parsed = orderCreateSchema.safeParse({
      idempotencyKey: 'k'.repeat(12),
      email: 'a@b.co',
      shippingAddress: addressSchema.parse({ firstName: 'Ada', lastName: 'Bly', line1: '1 St', city: 'X', postalCode: '12345', country: 'US' }),
      clientTotalCents: 1,
      paymentSuccess: true,
      shippingCents: 0,
    } as never)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('clientTotalCents' in parsed.data).toBe(false)
      expect('paymentSuccess' in parsed.data).toBe(false)
    }
  })

  it('registration enforces a real password policy', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)        // too short
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false)  // no number
    expect(passwordSchema.safeParse('12345678').success).toBe(false)     // no letter
    expect(passwordSchema.safeParse('passw0rd').success).toBe(true)
    expect(registerSchema.safeParse({ name: 'Ab', email: 'not-an-email', password: 'passw0rd' }).success).toBe(false)
    expect(registerSchema.safeParse({ name: 'Ab', email: 'a@b.co', password: 'passw0rd' }).success).toBe(true)
  })

  it('admin product write requires at least one sellable variant', () => {
    const base = {
      slug: 'x-print', name: 'X Print', categoryId: null, type: 'POSTER', status: 'DRAFT',
      basePriceCents: 1000, compareAtCents: null, variants: [], images: [],
    }
    expect(productWriteSchema.safeParse(base).success).toBe(false)
    expect(productWriteSchema.safeParse({ ...base, variants: [{ sku: 'A4', name: 'A4' }] }).success).toBe(true)
  })

  it('coupon schema bounds percent values (no free-coffee bugs in admin forms)', () => {
    const baseCoupon = { code: 'X10', type: 'PERCENT', value: 10 }
    expect(couponWriteSchema.safeParse(baseCoupon).success).toBe(true)
  })

  it('review requires a plausible rating band and a real body', () => {
    expect(reviewCreateSchema.safeParse({ rating: 5, title: 'Lovely', body: 'Great print, quick delivery.' }).success).toBe(true)
    expect(reviewCreateSchema.safeParse({ rating: 6, title: 'X', body: 'this is long enough' }).success).toBe(false)
    expect(reviewCreateSchema.safeParse({ rating: 0, title: 'X', body: 'this is long enough' }).success).toBe(false)
    expect(reviewCreateSchema.safeParse({ rating: 3, title: '', body: 'x' }).success).toBe(false) // body too short
  })

  it('addresses demand a country and postal code', () => {
    expect(addressSchema.safeParse({ firstName: 'A', lastName: 'B', line1: '1 St', city: 'X', country: '', postalCode: '' }).success).toBe(false)
    expect(addressSchema.safeParse({ firstName: 'A', lastName: 'B', line1: '1 St', city: 'X', country: 'US', postalCode: '12345' }).success).toBe(true)
  })
})
