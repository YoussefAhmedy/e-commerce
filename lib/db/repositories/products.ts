import { getDb, newId } from '@/lib/db'
import type { Category, Product, ProductImage, ProductType, ProductVariant } from '@/lib/db/types'

/**
 * Catalog repositories: categories, products (+ images/variants),
 * filtered/paginated listing, and keyword search.
 * All listing queries are indexed for scale; unknown sort keys are whitelisted.
 */

// ── row mapping ─────────────────────────────────────────────────────────

function jsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

function jsonObject(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val)]))
    }
    return {}
  } catch {
    return {}
  }
}

type Row = Record<string, unknown>

function mapVariant(r: Row): ProductVariant {
  return {
    id: String(r.id),
    productId: String(r.product_id),
    sku: String(r.sku),
    name: String(r.name),
    options: jsonObject(r.options as string),
    priceDeltaCents: Number(r.price_delta_cents),
    stock: Number(r.stock),
    reserved: Number(r.reserved),
    active: Number(r.active) === 1,
  }
}

function mapImage(r: Row): ProductImage {
  return {
    id: String(r.id),
    productId: String(r.product_id),
    url: String(r.url),
    alt: String(r.alt ?? ''),
    position: Number(r.position),
  }
}

function mapProduct(r: Row, images: ProductImage[], variants: ProductVariant[]): Product {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    summary: String(r.summary ?? ''),
    description: String(r.description ?? ''),
    categoryId: (r.category_id as string) ?? null,
    categoryName: (r.category_name as string) ?? null,
    categorySlug: (r.category_slug as string) ?? null,
    type: r.type as ProductType,
    status: r.status as Product['status'],
    basePriceCents: Number(r.base_price_cents),
    compareAtCents: (r.compare_at_cents as number) ?? null,
    currency: String(r.currency ?? 'USD'),
    tags: jsonArray(r.tags as string),
    attributes: jsonObject(r.attributes as string),
    featured: Number(r.featured) === 1,
    seoTitle: (r.seo_title as string) ?? null,
    seoDescription: (r.seo_description as string) ?? null,
    images,
    variants,
    ratingAvg: r.rating_avg != null ? Number(r.rating_avg) : null,
    ratingCount: Number(r.rating_count ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug,
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id AND r.status = 'APPROVED') AS rating_avg,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'APPROVED') AS rating_count
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`

function hydrate(r: Row): Product {
  const db = getDb()
  const images = (db
    .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY position')
    .all(r.id as string) as Row[]).map(mapImage)
  const variants = (db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY name')
    .all(r.id as string) as Row[]).map(mapVariant)
  return mapProduct(r, images, variants)
}

// ── categories ──────────────────────────────────────────────────────────

export function listCategories(): Category[] {
  const rows = getDb().prepare('SELECT * FROM categories ORDER BY position, name').all() as Row[]
  return rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: (r.description as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    position: Number(r.position),
  }))
}

export function getCategoryBySlug(slug: string): Category | null {
  const r = getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as Row | undefined
  if (!r) return null
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: (r.description as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    position: Number(r.position),
  }
}

export function upsertCategory(input: Omit<Category, 'id'> & { id?: string }): Category {
  const db = getDb()
  const id = input.id ?? newId()
  db.prepare(
    `INSERT INTO categories (id, slug, name, description, image_url, position)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name,
       description=excluded.description, image_url=excluded.image_url, position=excluded.position`,
  ).run(id, input.slug, input.name, input.description, input.imageUrl, input.position)
  return { id, ...input }
}

export function deleteCategory(id: string): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
}

// ── products: reads ─────────────────────────────────────────────────────

export function getProductBySlug(slug: string): Product | null {
  const r = getDb().prepare(`${PRODUCT_SELECT} WHERE p.slug = ?`).get(slug) as Row | undefined
  return r ? hydrate(r) : null
}

export function getProductById(id: string): Product | null {
  const r = getDb().prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id) as Row | undefined
  return r ? hydrate(r) : null
}

export function getVariant(variantId: string): ProductVariant | null {
  const r = getDb().prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId) as Row | undefined
  return r ? mapVariant(r) : null
}

export interface CatalogQuery {
  q?: string
  category?: string
  type?: ProductType
  minPriceCents?: number
  maxPriceCents?: number
  color?: string
  material?: string
  size?: string
  inStockOnly?: boolean
  featuredOnly?: boolean
  tags?: string[]
  sort?: 'relevance' | 'newest' | 'price-asc' | 'price-desc' | 'name' | 'popular'
  page?: number
  pageSize?: number
  includeUnpublished?: boolean
}

export interface CatalogResult {
  products: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const SORT_SQL: Record<NonNullable<CatalogQuery['sort']>, string> = {
  relevance: 'p.featured DESC, rating_count DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  'price-asc': 'p.base_price_cents ASC',
  'price-desc': 'p.base_price_cents DESC',
  name: 'p.name ASC',
  popular: 'rating_count DESC, p.created_at DESC',
}

export function queryCatalog(query: CatalogQuery): CatalogResult {
  const db = getDb()
  const where: string[] = []
  const params: Array<string | number> = []

  if (!query.includeUnpublished) {
    where.push(`p.status = 'PUBLISHED'`)
  }
  if (query.category) {
    where.push('c.slug = ?')
    params.push(query.category)
  }
  if (query.type) {
    where.push('p.type = ?')
    params.push(query.type)
  }
  if (query.minPriceCents != null) {
    where.push('p.base_price_cents >= ?')
    params.push(query.minPriceCents)
  }
  if (query.maxPriceCents != null) {
    where.push('p.base_price_cents <= ?')
    params.push(query.maxPriceCents)
  }
  if (query.featuredOnly) where.push('p.featured = 1')
  if (query.q) {
    // Multi-term keyword search across name/summary/description/tags —
    // every term must match somewhere. Indexed-ish at boutique scale;
    // upgrade path (FTS5/semantic) is documented in docs/search.md.
    const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
    for (const term of terms) {
      where.push(
        `(LOWER(p.name) LIKE ? OR LOWER(p.summary) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.tags) LIKE ? OR LOWER(c.name) LIKE ?)`,
      )
      const like = `%${term}%`
      params.push(like, like, like, like, like)
    }
  }
  if (query.color) {
    where.push(`LOWER(json_extract(p.attributes, '$.color')) = ?`)
    params.push(query.color.toLowerCase())
  }
  if (query.material) {
    where.push(`LOWER(json_extract(p.attributes, '$.material')) = ?`)
    params.push(query.material.toLowerCase())
  }
  if (query.size) {
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active = 1 AND json_extract(v.options, '$.size') = ?)`)
    params.push(query.size)
  }
  if (query.inStockOnly) {
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active = 1 AND (v.stock - v.reserved) > 0)`)
  }
  if (query.tags && query.tags.length > 0) {
    const ors = query.tags.map(() => `LOWER(p.tags) LIKE ?`).join(' OR ')
    where.push(`(${ors})`)
    for (const t of query.tags) params.push(`%"${t.toLowerCase()}"%`)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const sort = query.sort ?? (query.q ? 'relevance' : 'relevance')
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 12))

  const total = Number(
    (db
      .prepare(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`)
      .get(...params) as Row).n,
  )
  const rows = db
    .prepare(`${PRODUCT_SELECT} ${whereSql} ORDER BY ${SORT_SQL[sort]} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as Row[]

  // Hydrate in one batch (no N+1): fetch all images+variants for the page.
  const ids = rows.map((r) => String(r.id))
  const imagesByProduct = new Map<string, ProductImage[]>()
  const variantsByProduct = new Map<string, ProductVariant[]>()
  if (ids.length > 0) {
    const ph = ids.map(() => '?').join(',')
    const imgs = db.prepare(`SELECT * FROM product_images WHERE product_id IN (${ph}) ORDER BY position`).all(...ids) as Row[]
    for (const i of imgs) {
      const m = mapImage(i)
      imagesByProduct.set(m.productId, [...(imagesByProduct.get(m.productId) ?? []), m])
    }
    const vars = db
      .prepare(`SELECT * FROM product_variants WHERE product_id IN (${ph}) AND active = 1 ORDER BY name`)
      .all(...ids) as Row[]
    for (const v of vars) {
      const m = mapVariant(v)
      variantsByProduct.set(m.productId, [...(variantsByProduct.get(m.productId) ?? []), m])
    }
  }

  return {
    products: rows.map((r) =>
      mapProduct(
        r,
        imagesByProduct.get(String(r.id)) ?? [],
        variantsByProduct.get(String(r.id)) ?? [],
      ),
    ),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Autocomplete: cheap prefix search on names + tags, limited. */
export function searchSuggest(q: string, limit = 6): Array<{ slug: string; name: string; type: ProductType; priceCents: number; imageUrl: string | null }> {
  const like = `%${q.toLowerCase().slice(0, 60)}%`
  const rows = getDb()
    .prepare(
      `SELECT p.slug, p.name, p.type, p.base_price_cents,
        (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY position LIMIT 1) AS image_url
       FROM products p
       WHERE p.status = 'PUBLISHED' AND (LOWER(p.name) LIKE ? OR LOWER(p.tags) LIKE ?)
       ORDER BY p.featured DESC, p.name ASC
       LIMIT ?`,
    )
    .all(like, like, limit) as Row[]
  return rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name),
    type: r.type as ProductType,
    priceCents: Number(r.base_price_cents),
    imageUrl: (r.image_url as string) ?? null,
  }))
}

/** Distinct facet values for filter UI (frame materials/colors, poster sizes). */
export function catalogFacets(): { colors: string[]; materials: string[]; sizes: string[]; priceRange: { minCents: number; maxCents: number } } {
  const db = getDb()
  const colors = (db
    .prepare(`SELECT DISTINCT json_extract(attributes, '$.color') AS c FROM products WHERE status='PUBLISHED' AND json_extract(attributes,'$.color') IS NOT NULL ORDER BY c`)
    .all() as Array<{ c: string }>).map((r) => r.c)
  const materials = (db
    .prepare(`SELECT DISTINCT json_extract(attributes, '$.material') AS m FROM products WHERE status='PUBLISHED' AND json_extract(attributes,'$.material') IS NOT NULL ORDER BY m`)
    .all() as Array<{ m: string }>).map((r) => r.m)
  const sizes = (db
    .prepare(`SELECT DISTINCT json_extract(v.options, '$.size') AS s FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.status='PUBLISHED' AND json_extract(v.options,'$.size') IS NOT NULL ORDER BY s`)
    .all() as Array<{ s: string }>).map((r) => r.s)
  const range = db
    .prepare(`SELECT MIN(base_price_cents) AS mn, MAX(base_price_cents) AS mx FROM products WHERE status='PUBLISHED'`)
    .get() as { mn: number | null; mx: number | null }
  return {
    colors,
    materials,
    sizes,
    priceRange: { minCents: range.mn ?? 0, maxCents: range.mx ?? 0 },
  }
}

// ── products: writes (admin) ────────────────────────────────────────────

export interface ProductWriteInput {
  slug: string
  name: string
  summary: string
  description: string
  categoryId: string | null
  type: ProductType
  status: Product['status']
  basePriceCents: number
  compareAtCents: number | null
  currency?: string
  tags: string[]
  attributes: Record<string, string>
  featured: boolean
  seoTitle: string | null
  seoDescription: string | null
  images: Array<{ url: string; alt: string; position: number }>
  variants: Array<{
    id?: string
    sku: string
    name: string
    options: Record<string, string>
    priceDeltaCents: number
    stock: number
    active: boolean
  }>
}

export function createProduct(input: ProductWriteInput): Product {
  const db = getDb()
  const id = newId()
  db.prepare(
    `INSERT INTO products (id, slug, name, summary, description, category_id, type, status,
      base_price_cents, compare_at_cents, currency, tags, attributes, featured, seo_title, seo_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.slug, input.name, input.summary, input.description, input.categoryId, input.type,
    input.status, input.basePriceCents, input.compareAtCents, input.currency ?? 'USD',
    JSON.stringify(input.tags.map((t) => t.toLowerCase())), JSON.stringify(input.attributes),
    input.featured ? 1 : 0, input.seoTitle, input.seoDescription,
  )
  for (const img of input.images) {
    db.prepare('INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, ?)').run(
      newId(), id, img.url, img.alt, img.position,
    )
  }
  for (const v of input.variants) {
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, name, options, price_delta_cents, stock, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), id, v.sku, v.name, JSON.stringify(v.options), v.priceDeltaCents, v.stock, v.active ? 1 : 0)
  }
  return getProductById(id)!
}

export function updateProduct(id: string, input: ProductWriteInput): Product {
  const db = getDb()
  db.prepare(
    `UPDATE products SET slug=?, name=?, summary=?, description=?, category_id=?, type=?, status=?,
      base_price_cents=?, compare_at_cents=?, currency=?, tags=?, attributes=?, featured=?,
      seo_title=?, seo_description=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=?`,
  ).run(
    input.slug, input.name, input.summary, input.description, input.categoryId, input.type,
    input.status, input.basePriceCents, input.compareAtCents, input.currency ?? 'USD',
    JSON.stringify(input.tags.map((t) => t.toLowerCase())), JSON.stringify(input.attributes),
    input.featured ? 1 : 0, input.seoTitle, input.seoDescription, id,
  )
  // Replace images wholesale; variants upserted by sku.
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id)
  for (const img of input.images) {
    db.prepare('INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, ?)').run(
      newId(), id, img.url, img.alt, img.position,
    )
  }
  const existingSkus = new Set(
    (db.prepare('SELECT sku FROM product_variants WHERE product_id = ?').all(id) as Array<{ sku: string }>).map((r) => r.sku),
  )
  const keptSkus = new Set(input.variants.map((v) => v.sku))
  for (const sku of existingSkus) {
    if (!keptSkus.has(sku)) {
      // Retire (never hard-delete a variant referenced by orders).
      db.prepare('UPDATE product_variants SET active = 0 WHERE product_id = ? AND sku = ?').run(id, sku)
    }
  }
  for (const v of input.variants) {
    if (existingSkus.has(v.sku)) {
      db.prepare(
        `UPDATE product_variants SET name=?, options=?, price_delta_cents=?, stock=?, active=? WHERE product_id=? AND sku=?`,
      ).run(v.name, JSON.stringify(v.options), v.priceDeltaCents, v.stock, v.active ? 1 : 0, id, v.sku)
    } else {
      db.prepare(
        `INSERT INTO product_variants (id, product_id, sku, name, options, price_delta_cents, stock, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId(), id, v.sku, v.name, JSON.stringify(v.options), v.priceDeltaCents, v.stock, v.active ? 1 : 0)
    }
  }
  return getProductById(id)!
}

export function adjustStock(variantId: string, delta: number): void {
  getDb()
    .prepare(`UPDATE product_variants SET stock = MAX(0, stock + ?) WHERE id = ?`)
    .run(delta, variantId)
}

/** Low-stock variants for admin dashboards. */
export function lowStockVariants(threshold = 3): Array<ProductVariant & { productName: string; productSlug: string }> {
  const rows = getDb()
    .prepare(
      `SELECT v.*, p.name AS product_name, p.slug AS product_slug
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.active = 1 AND (v.stock - v.reserved) <= ? AND p.status != 'ARCHIVED'
       ORDER BY (v.stock - v.reserved) ASC`,
    )
    .all(threshold) as Row[]
  return rows.map((r) => ({
    ...mapVariant(r),
    productName: String(r.product_name),
    productSlug: String(r.product_slug),
  }))
}
