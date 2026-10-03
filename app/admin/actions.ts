'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/security/guard'
import type { PublicUser } from '@/lib/db/types'
import { AppError, isAppError } from '@/lib/domain/errors'
import { newId } from '@/lib/db'
import {
  productWriteSchema, categoryWriteSchema, couponWriteSchema,
  orderTransitionSchema, reviewModerateSchema, aiGenerateSchema,
} from '@/lib/validation/schemas'
import {
  createProduct, updateProduct, getProductById,
  upsertCategory, deleteCategory as repoDeleteCategory, listCategories,
} from '@/lib/db/repositories/products'
import {
  upsertCoupon, deleteCoupon as repoDeleteCoupon,
} from '@/lib/db/repositories/orders'
import { transitionOrder } from '@/lib/services/orders'
import { moderateReview as repoModerateReview, audit } from '@/lib/db/repositories/engagement'
import { generateAdminContent } from '@/lib/services/assistant'
import { normalizeCode } from '@/lib/domain/coupons'
import { ZodError } from 'zod'

/**
 * Admin server actions.
 * EVERY action re-verifies the ADMIN role server-side (layout guards are
 * never the security boundary) and writes an audit-log entry.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string[]> }

async function run<T>(entity: string, action: string, fn: (admin: PublicUser) => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    const admin = await requireAdmin()
    const data = await fn(admin)
    revalidatePath('/admin')
    return { ok: true, data }
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, error: 'Please fix the highlighted fields.', fields: err.flatten().fieldErrors as Record<string, string[]> }
    }
    if (isAppError(err)) return { ok: false, error: err.message }
    console.error(`admin action ${action} on ${entity} failed`, err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}

// ── products ──────────────────────────────────────────────────────────────

export async function saveProduct(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ productId: string; slug: string }>> {
  return run('product', id ? 'ADMIN_PRODUCT_UPDATE' : 'ADMIN_PRODUCT_CREATE', async (admin) => {
    const parsed = productWriteSchema.parse(input)
    const payload = {
      ...parsed,
      currency: 'USD',
    }
    const product = id ? updateProduct(id, payload) : createProduct(payload)
    audit({ actorId: admin.id, action: id ? 'ADMIN_PRODUCT_UPDATE' : 'ADMIN_PRODUCT_CREATE', entity: 'product', entityId: product.id, meta: { slug: product.slug, priceCents: product.basePriceCents, status: product.status } })
    revalidatePath('/catalog')
    revalidatePath(`/products/${product.slug}`)
    return { productId: product.id, slug: product.slug }
  })
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  return run('product', 'ADMIN_PRODUCT_ARCHIVE', async (admin) => {
    const product = getProductById(id)
    if (!product) throw new AppError('NOT_FOUND', 'Product not found.')
    updateProduct(id, {
      slug: product.slug,
      name: product.name,
      summary: product.summary,
      description: product.description,
      categoryId: product.categoryId,
      type: product.type,
      status: 'ARCHIVED',
      basePriceCents: product.basePriceCents,
      compareAtCents: product.compareAtCents,
      tags: product.tags,
      attributes: product.attributes,
      featured: false,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      images: product.images.map((i) => ({ url: i.url, alt: i.alt, position: i.position })),
      variants: product.variants.map((v) => ({
        sku: v.sku, name: v.name, options: v.options,
        priceDeltaCents: v.priceDeltaCents, stock: v.stock, active: v.active,
      })),
    })
    audit({ actorId: admin.id, action: 'ADMIN_PRODUCT_ARCHIVE', entity: 'product', entityId: id, meta: { slug: product.slug } })
    revalidatePath('/catalog')
    return undefined
  })
}

// ── categories ────────────────────────────────────────────────────────────

export async function saveCategory(input: unknown, id?: string): Promise<ActionResult<{ categoryId: string }>> {
  return run('category', 'ADMIN_CATEGORY_SAVE', async (admin) => {
    const parsed = categoryWriteSchema.parse(input)
    const category = upsertCategory({ id: id ?? newId(), ...parsed })
    audit({ actorId: admin.id, action: 'ADMIN_CATEGORY_SAVE', entity: 'category', entityId: category.id, meta: { slug: category.slug } })
    revalidatePath('/catalog')
    return { categoryId: category.id }
  })
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return run('category', 'ADMIN_CATEGORY_DELETE', async (admin) => {
    repoDeleteCategory(id)
    audit({ actorId: admin.id, action: 'ADMIN_CATEGORY_DELETE', entity: 'category', entityId: id })
    revalidatePath('/catalog')
    return undefined
  })
}

export async function listCategoryOptions(): Promise<Array<{ id: string; name: string; slug: string }>> {
  await requireAdmin()
  return listCategories().map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
}

// ── orders ────────────────────────────────────────────────────────────────

export async function adminTransitionOrder(input: unknown, orderId: string): Promise<ActionResult> {
  return run('order', 'ADMIN_ORDER_TRANSITION', async (admin) => {
    const parsed = orderTransitionSchema.parse(input)
    transitionOrder(orderId, parsed.action, admin, {
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
    })
    revalidatePath('/admin/orders')
    return undefined
  })
}

// ── coupons ───────────────────────────────────────────────────────────────

export async function saveCoupon(input: unknown): Promise<ActionResult> {
  return run('coupon', 'ADMIN_COUPON_SAVE', async (admin) => {
    const parsed = couponWriteSchema.parse(input)
    const coupon = upsertCoupon({
      id: parsed.id ?? newId(),
      code: normalizeCode(parsed.code),
      type: parsed.type,
      value: parsed.value,
      minSubtotalCents: parsed.minSubtotalCents,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      maxRedemptions: parsed.maxRedemptions,
      perUserLimit: parsed.perUserLimit,
      active: parsed.active,
    })
    audit({ actorId: admin.id, action: 'ADMIN_COUPON_SAVE', entity: 'coupon', entityId: coupon.id, meta: { code: normalizeCode(parsed.code), type: parsed.type, value: parsed.value } })
    revalidatePath('/admin/coupons')
    return undefined
  })
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  return run('coupon', 'ADMIN_COUPON_DELETE', async (admin) => {
    repoDeleteCoupon(id)
    audit({ actorId: admin.id, action: 'ADMIN_COUPON_DELETE', entity: 'coupon', entityId: id })
    revalidatePath('/admin/coupons')
    return undefined
  })
}

// ── reviews ───────────────────────────────────────────────────────────────

export async function moderateReview(input: unknown): Promise<ActionResult> {
  return run('review', 'ADMIN_REVIEW_MODERATE', async (admin) => {
    const parsed = reviewModerateSchema.parse(input)
    repoModerateReview(parsed.reviewId, parsed.status)
    audit({ actorId: admin.id, action: `ADMIN_REVIEW_${parsed.status}`, entity: 'review', entityId: parsed.reviewId })
    revalidatePath('/admin/reviews')
    return undefined
  })
}

// ── AI tools ──────────────────────────────────────────────────────────────

export async function aiGenerate(input: unknown): Promise<ActionResult<{ text: string; note: string; grounded: boolean }>> {
  return run('ai', 'ADMIN_AI_GENERATE', async (admin) => {
    const parsed = aiGenerateSchema.parse(input)
    const result = await generateAdminContent(parsed)
    audit({ actorId: admin.id, action: 'ADMIN_AI_GENERATE', entity: 'ai', entityId: parsed.kind, meta: { grounded: result.grounded } })
    return { text: result.text, note: result.note, grounded: result.grounded }
  })
}
