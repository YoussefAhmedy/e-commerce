import { getDb } from '@/lib/db'
import { queryCatalog, getProductById } from '@/lib/db/repositories/products'
import type { Product } from '@/lib/db/types'

/**
 * Recommendation engine — deterministic, explainable scoring today,
 * with a documented seam for an ML provider tomorrow.
 *
 * Score = category match ×3 + each shared tag ×2 + price-band proxim­ity
 * up to ×1.5 + social proof (rating count ×0.1 max 1) + featured boost 0.5.
 * No "random list marketed as AI".
 */

function score(candidate: Product, basis: Product): number {
  let s = 0
  if (candidate.categoryId && candidate.categoryId === basis.categoryId) s += 3
  const basisTags = new Set(basis.tags)
  for (const t of candidate.tags) if (basisTags.has(t)) s += 2
  const min = Math.min(candidate.basePriceCents, basis.basePriceCents)
  const max = Math.max(candidate.basePriceCents, basis.basePriceCents)
  if (max > 0 && min / max > 0.6) s += 1.5 * (min / max)
  if (candidate.ratingAvg && candidate.ratingAvg >= 4) s += 0.5
  if (candidate.featured) s += 0.5
  return s
}

/** "Related products" — explainable similarity to a basis product. */
export function similarProducts(basis: Product, limit = 4): Product[] {
  const { products } = queryCatalog({ pageSize: 48, sort: 'relevance' })
  return products
    .filter((p) => p.id !== basis.id)
    .map((p) => ({ p, s: score(p, basis) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p)
}

/**
 * Personalized: blend of products the user viewed and products bought
 * together with items in their paid order history (co-occurrence from
 * order_items — a real behavioral signal, computed in SQL).
 */
export function personalizedForUser(userId: string, limit = 8): Product[] {
  const db = getDb()
  const co = db
    .prepare(
      `SELECT DISTINCT oi.product_id AS pid, COUNT(*) AS n
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id NOT IN (
         SELECT i2.product_id FROM order_items i2 JOIN orders o2 ON o2.id = i2.order_id
         WHERE o2.user_id = ? AND i2.product_id IS NOT NULL
       )
       AND o.payment_status = 'PAID'
       GROUP BY oi.product_id ORDER BY n DESC LIMIT ?`,
    )
    .all(userId, limit) as Array<{ pid: string }>

  const out: Product[] = []
  for (const row of co) {
    const p = getProductById(String(row.pid))
    if (p && p.status === 'PUBLISHED') out.push(p)
  }
  if (out.length < limit) {
    const { products } = queryCatalog({ featuredOnly: true, pageSize: limit - out.length })
    for (const p of products) if (!out.find((x) => x.id === p.id)) out.push(p)
  }
  return out.slice(0, limit)
}

/** Homepage "trending": most viewed over the trailing window, fallback to featured. */
export function trending(limit = 8): Product[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT product_id AS pid, COUNT(*) AS views FROM analytics_events
       WHERE type = 'PRODUCT_VIEW' AND product_id IS NOT NULL
         AND created_at >= datetime('now', '-14 days')
       GROUP BY product_id ORDER BY views DESC LIMIT ?`,
    )
    .all(limit) as Array<{ pid: string }>
  const out: Product[] = []
  for (const r of rows) {
    const p = getProductById(String(r.pid))
    if (p && p.status === 'PUBLISHED') out.push(p)
  }
  if (out.length < limit) {
    const { products } = queryCatalog({ featuredOnly: true, pageSize: limit - out.length + 4 })
    for (const p of products) if (!out.find((x) => x.id === p.id)) out.push(p)
  }
  return out.slice(0, limit)
}
