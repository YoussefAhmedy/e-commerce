import { z } from 'zod'

/**
 * Input contracts — parsed at the API boundary (and reused by admin forms).
 * Never trust the browser: everything crossing the wire is validated here.
 */

// ── auth ────────────────────────────────────────────────────────────────

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128)
  .regex(/[a-zA-Z]/, 'Password needs at least one letter.')
  .regex(/[0-9]/, 'Password needs at least one number.')

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
})

export const forgotPasswordSchema = z.object({ email: z.email().max(254) })

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
})

export const verifyEmailSchema = z.object({ token: z.string().min(10).max(200) })

export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(80) })

// ── address / checkout ──────────────────────────────────────────────────

export const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  line1: z.string().trim().min(2).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(2), // ISO alpha-2
  phone: z.string().trim().max(30).optional(),
})

export const cartAddSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(20).default(1),
  customization: z
    .object({
      uploadId: z.string().max(64).optional(),
      frameVariantId: z.string().max(64).optional(),
      note: z.string().max(500).optional(),
    })
    .nullish(),
})

export const cartUpdateSchema = z.object({
  itemId: z.string().min(1).max(64),
  quantity: z.number().int().min(0).max(20),
})

export const orderCreateSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  email: z.email().max(254).optional(), // required for guests
  shippingAddress: addressSchema,
  couponCode: z.string().trim().max(40).optional(),
})

export const couponValidateSchema = z.object({ code: z.string().trim().min(2).max(40) })

// ── reviews / wishlist ──────────────────────────────────────────────────

export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().min(4).max(2000),
})

export const wishlistToggleSchema = z.object({ productId: z.string().min(1).max(64) })

// ── analytics / assistant ───────────────────────────────────────────────

export const analyticsEventSchema = z.object({
  type: z.enum(['PRODUCT_VIEW', 'ADD_TO_CART', 'SEARCH']),
  productId: z.string().max(64).optional(),
  meta: z.record(z.string(), z.string().max(200)).optional(),
})

export const assistantMessageSchema = z.object({
  message: z.string().trim().min(1).max(600),
  thread: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .max(12)
    .default([]),
})

// ── admin ───────────────────────────────────────────────────────────────

export const productWriteSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case.'),
  name: z.string().trim().min(2).max(140),
  summary: z.string().trim().max(240).default(''),
  description: z.string().trim().max(8000).default(''),
  categoryId: z.string().nullable(),
  type: z.enum(['POSTER', 'FRAME']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  basePriceCents: z.number().int().min(0).max(10_000_000),
  compareAtCents: z.number().int().min(0).max(10_000_000).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  attributes: z.record(z.string(), z.string().max(80)).default({}),
  featured: z.boolean().default(false),
  seoTitle: z.string().trim().max(160).nullable().default(null),
  seoDescription: z.string().trim().max(300).nullable().default(null),
  images: z.array(z.object({ url: z.string().max(500), alt: z.string().max(200).default(''), position: z.number().int().min(0) })).max(12).default([]),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        sku: z.string().trim().min(1).max(64),
        name: z.string().trim().min(1).max(80),
        options: z.record(z.string(), z.string().max(80)).default({}),
        priceDeltaCents: z.number().int().min(0).max(10_000_000).default(0),
        stock: z.number().int().min(0).max(100_000).default(0),
        active: z.boolean().default(true),
      }),
    )
    .min(1),
})

export const categoryWriteSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).nullable().default(null),
  imageUrl: z.string().max(500).nullable().default(null),
  position: z.number().int().min(0).default(0),
})

export const couponWriteSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9-]+$/i),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().min(1).max(1_000_000),
  minSubtotalCents: z.number().int().min(0).default(0),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  maxRedemptions: z.number().int().min(1).nullable().default(null),
  perUserLimit: z.number().int().min(0).max(100).default(1),
  active: z.boolean().default(true),
})

export const orderTransitionSchema = z.object({
  action: z.enum(['START_PROCESSING', 'SHIP', 'DELIVER', 'CANCEL', 'REFUND']),
  trackingNumber: z.string().trim().max(80).optional(),
  carrier: z.string().trim().max(60).optional(),
})

export const reviewModerateSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED']),
})

export const aiGenerateSchema = z.object({
  kind: z.enum(['description', 'seo', 'tags']),
  name: z.string().trim().min(2).max(140),
  category: z.string().trim().max(80).default(''),
  attributes: z.record(z.string(), z.string()).default({}),
  keywords: z.string().trim().max(200).default(''),
})
