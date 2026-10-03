import { getDb, newId, newToken } from '@/lib/db'
import type { Cart, CartCustomization, CartLine } from '@/lib/db/types'
import { cartLineUnitPriceCents } from '@/lib/domain/pricing'
import { getProductById, getVariant } from './products'

/**
 * Server-side carts. Every read re-prices lines from the catalog —
 * a stored unit price would go stale when a merchant edits prices,
 * and a client-supplied price is an attack vector.
 */

type Row = Record<string, unknown>

function parseCustomization(raw: string | null): CartCustomization | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as CartCustomization
  } catch {
    return null
  }
}

export function findActiveCartByToken(token: string): { id: string; token: string; userId: string | null } | null {
  const r = getDb()
    .prepare(`SELECT * FROM carts WHERE token = ? AND status = 'ACTIVE'`)
    .get(token) as Row | undefined
  return r ? { id: String(r.id), token: String(r.token), userId: (r.user_id as string) ?? null } : null
}

export function findActiveCartByUser(userId: string): { id: string; token: string; userId: string | null } | null {
  const r = getDb()
    .prepare(`SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as Row | undefined
  return r ? { id: String(r.id), token: String(r.token), userId: (r.user_id as string) ?? null } : null
}

export function createCart(userId: string | null): { id: string; token: string } {
  const id = newId()
  const token = newToken(24)
  getDb().prepare('INSERT INTO carts (id, token, user_id) VALUES (?, ?, ?)').run(id, token, userId)
  return { id, token }
}

export function attachCartToUser(cartId: string, userId: string): void {
  getDb()
    .prepare(`UPDATE carts SET user_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(userId, cartId)
}

export function markCartCheckedOut(cartId: string): void {
  getDb().prepare(`UPDATE carts SET status = 'CHECKED_OUT' WHERE id = ?`).run(cartId)
}

export function touchCart(cartId: string): void {
  getDb().prepare(`UPDATE carts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(cartId)
}

/** Full cart with live-priced lines. Unavailable variants are dropped from the view but kept in DB. */
export function loadCart(cartId: string): Cart | null {
  const db = getDb()
  const cr = db.prepare('SELECT * FROM carts WHERE id = ?').get(cartId) as Row | undefined
  if (!cr) return null
  const items = db
    .prepare('SELECT * FROM cart_items WHERE cart_id = ? ORDER BY created_at')
    .all(cartId) as Row[]

  const lines: CartLine[] = []
  for (const it of items) {
    const variant = getVariant(String(it.variant_id))
    if (!variant) continue
    const product = getProductById(variant.productId)
    if (!product || product.status === 'ARCHIVED') continue
    const customization = parseCustomization((it.customization as string) ?? null)
    let frame: { product: NonNullable<ReturnType<typeof getProductById>>; variant: NonNullable<ReturnType<typeof getVariant>> } | null = null
    if (customization?.frameVariantId) {
      const fv = getVariant(customization.frameVariantId)
      if (fv) {
        const fp = getProductById(fv.productId)
        if (fp) frame = { product: fp, variant: fv }
      }
    }
    lines.push({
      id: String(it.id),
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: variant.name,
      sku: variant.sku,
      imageUrl: customization?.uploadKey
        ? `/api/media/${customization.uploadKey}`
        : (product.images[0]?.url ?? null),
      quantity: Number(it.quantity),
      customization,
      unitPriceCents: cartLineUnitPriceCents({ product, variant, customization, frame }),
      availableStock: Math.max(0, variant.stock - variant.reserved),
    })
  }

  return {
    id: String(cr.id),
    token: String(cr.token),
    userId: (cr.user_id as string) ?? null,
    status: cr.status as Cart['status'],
    lines,
  }
}

/** Idempotent upsert: same variant+customization in one cart → quantity increase (capped at stock). */
export function addCartItem(input: {
  cartId: string
  variantId: string
  quantity: number
  customization: CartCustomization | null
}): void {
  const db = getDb()
  const customizationJson = input.customization ? JSON.stringify(input.customization) : null
  const existing = db
    .prepare(
      `SELECT * FROM cart_items WHERE cart_id = ?
         AND variant_id = ?
         AND (customization IS ? OR customization = ?)`,
    )
    .get(input.cartId, input.variantId, customizationJson, customizationJson) as Row | undefined

  const variant = getVariant(input.variantId)
  const maxAvailable = variant ? Math.max(0, variant.stock - variant.reserved) : 0

  if (existing) {
    const nextQty = Math.min(Number(existing.quantity) + input.quantity, Math.max(maxAvailable, 1))
    db.prepare(`UPDATE cart_items SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(nextQty, String(existing.id))
  } else {
    db.prepare('INSERT INTO cart_items (id, cart_id, variant_id, quantity, customization) VALUES (?, ?, ?, ?, ?)')
      .run(newId(), input.cartId, input.variantId, Math.min(input.quantity, Math.max(maxAvailable, 1)), customizationJson)
  }
  touchCart(input.cartId)
}

export function updateCartItemQuantity(itemId: string, quantity: number): void {
  const db = getDb()
  const row = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(itemId) as Row | undefined
  if (!row) return
  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId)
    return
  }
  const variant = getVariant(String(row.variant_id))
  const maxAvailable = variant ? Math.max(0, variant.stock - variant.reserved) : 0
  const nextQty = Math.max(1, Math.min(quantity, Math.max(maxAvailable, 1)))
  db.prepare(`UPDATE cart_items SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(nextQty, itemId)
  touchCart(String(row.cart_id))
}

export function removeCartItem(itemId: string): void {
  const db = getDb()
  const row = db.prepare('SELECT cart_id FROM cart_items WHERE id = ?').get(itemId) as Row | undefined
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId)
  if (row) touchCart(String(row.cart_id))
}

export function cartItemBelongsToCart(itemId: string, cartId: string): boolean {
  return Boolean(getDb().prepare('SELECT 1 FROM cart_items WHERE id = ? AND cart_id = ?').get(itemId, cartId))
}

/** Guest → account merge on login: same-variant lines combine (unique key does the work). */
export function mergeCarts(guestCartId: string, userCartId: string, userId: string): void {
  const db = getDb()
  const guestItems = db.prepare('SELECT * FROM cart_items WHERE cart_id = ?').all(guestCartId) as Row[]
  for (const gi of guestItems) {
    addCartItem({
      cartId: userCartId,
      variantId: String(gi.variant_id),
      quantity: Number(gi.quantity),
      customization: parseCustomization((gi.customization as string) ?? null),
    })
  }
  db.prepare(`UPDATE carts SET status = 'ABANDONED' WHERE id = ?`).run(guestCartId)
  attachCartToUser(userCartId, userId)
}
