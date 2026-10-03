import { getDb, newId } from '@/lib/db'
import type {
  AddressInput, Coupon, Order, OrderItem, OrderStatus, PaymentStatus, FulfillmentStatus,
} from '@/lib/db/types'

/** Orders, order items, payments, webhook event ledger, coupons. */

type Row = Record<string, unknown>

function parseJsonObject(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val)]))
      : {}
  } catch {
    return {}
  }
}

function mapOrder(r: Row, items: OrderItem[]): Order {
  return {
    id: String(r.id),
    number: String(r.number),
    userId: (r.user_id as string) ?? null,
    guestEmail: (r.guest_email as string) ?? null,
    status: r.status as OrderStatus,
    paymentStatus: r.payment_status as PaymentStatus,
    fulfillmentStatus: r.fulfillment_status as FulfillmentStatus,
    currency: String(r.currency),
    subtotalCents: Number(r.subtotal_cents),
    discountCents: Number(r.discount_cents),
    taxCents: Number(r.tax_cents),
    shippingCents: Number(r.shipping_cents),
    totalCents: Number(r.total_cents),
    couponId: (r.coupon_id as string) ?? null,
    couponCode: (r.coupon_code as string) ?? null,
    shippingAddress: parseJsonObject(r.shipping_address) as unknown as AddressInput,
    shippingMethod: String(r.shipping_method),
    trackingNumber: (r.tracking_number as string) ?? null,
    carrier: (r.carrier as string) ?? null,
    idempotencyKey: String(r.idempotency_key),
    placedAt: String(r.placed_at),
    items,
  }
}

function mapOrderItem(r: Row): OrderItem {
  return {
    id: String(r.id),
    orderId: String(r.order_id),
    productId: (r.product_id as string) ?? null,
    variantId: (r.variant_id as string) ?? null,
    name: String(r.name),
    sku: String(r.sku),
    options: parseJsonObject(r.options),
    previewUrl: (r.preview_url as string) ?? null,
    quantity: Number(r.quantity),
    unitPriceCents: Number(r.unit_price_cents),
    lineTotalCents: Number(r.line_total_cents),
  }
}

export function getOrderById(id: string): Order | null {
  const db = getDb()
  const r = db
    .prepare(`SELECT o.*, c.code AS coupon_code FROM orders o LEFT JOIN coupons c ON c.id = o.coupon_id WHERE o.id = ?`)
    .get(id) as Row | undefined
  if (!r) return null
  const items = (db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as Row[]).map(mapOrderItem)
  return mapOrder(r, items)
}

export function getOrderByNumber(number: string): Order | null {
  const r = getDb().prepare('SELECT id FROM orders WHERE number = ?').get(number) as Row | undefined
  return r ? getOrderById(String(r.id)) : null
}

/** Idempotency: the retried POST /orders returns the original order, not a duplicate. */
export function getOrderByIdempotencyKey(key: string): Order | null {
  const r = getDb().prepare('SELECT id FROM orders WHERE idempotency_key = ?').get(key) as Row | undefined
  return r ? getOrderById(String(r.id)) : null
}

export function insertOrder(order: Omit<Order, 'items'>, items: Omit<OrderItem, 'id' | 'orderId'>[]): Order {
  const db = getDb()
  db.prepare(
    `INSERT INTO orders (id, number, user_id, guest_email, status, payment_status, fulfillment_status,
      currency, subtotal_cents, discount_cents, tax_cents, shipping_cents, total_cents, coupon_id,
      shipping_address, shipping_method, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    order.id, order.number, order.userId, order.guestEmail, order.status, order.paymentStatus,
    order.fulfillmentStatus, order.currency, order.subtotalCents, order.discountCents, order.taxCents,
    order.shippingCents, order.totalCents, order.couponId, JSON.stringify(order.shippingAddress),
    order.shippingMethod, order.idempotencyKey,
  )
  for (const it of items) {
    db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, variant_id, name, sku, options, preview_url, quantity, unit_price_cents, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), order.id, it.productId, it.variantId, it.name, it.sku,
      JSON.stringify(it.options), it.previewUrl, it.quantity, it.unitPriceCents, it.lineTotalCents)
  }
  return getOrderById(order.id)!
}

/** Human order number: PRT-000123 via a transactional counter (no collisions, no leaks of total count). */
export function nextOrderNumber(): string {
  const db = getDb()
  db.prepare(`INSERT INTO counters (key, value) VALUES ('order', 0) ON CONFLICT(key) DO NOTHING`).run()
  db.prepare(`UPDATE counters SET value = value + 1 WHERE key = 'order'`).run()
  const n = Number((db.prepare(`SELECT value FROM counters WHERE key = 'order'`).get() as { value: number }).value)
  return `PRT-${String(n).padStart(6, '0')}`
}

export function applyOrderPatch(id: string, patch: {
  status?: OrderStatus; paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus
  trackingNumber?: string; carrier?: string
}): void {
  const db = getDb()
  db.prepare(
    `UPDATE orders SET
      status = COALESCE(?, status),
      payment_status = COALESCE(?, payment_status),
      fulfillment_status = COALESCE(?, fulfillment_status),
      tracking_number = COALESCE(?, tracking_number),
      carrier = COALESCE(?, carrier),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
  ).run(patch.status ?? null, patch.paymentStatus ?? null, patch.fulfillmentStatus ?? null,
    patch.trackingNumber ?? null, patch.carrier ?? null, id)
}

export function listOrdersByUser(userId: string, limit = 50): Order[] {
  const rows = getDb()
    .prepare(`SELECT id FROM orders WHERE user_id = ? ORDER BY placed_at DESC LIMIT ?`)
    .all(userId, limit) as Row[]
  return rows.map((r) => getOrderById(String(r.id))!)
}

export interface AdminOrderFilter {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  q?: string
  page?: number
  pageSize?: number
}

export function listOrders(filter: AdminOrderFilter): { orders: Order[]; total: number } {
  const db = getDb()
  const where: string[] = []
  const params: Array<string | number> = []
  if (filter.status) { where.push('status = ?'); params.push(filter.status) }
  if (filter.paymentStatus) { where.push('payment_status = ?'); params.push(filter.paymentStatus) }
  if (filter.q) {
    where.push('(number LIKE ? OR guest_email LIKE ?)')
    params.push(`%${filter.q}%`, `%${filter.q}%`)
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const total = Number((db.prepare(`SELECT COUNT(*) AS n FROM orders ${whereSql}`).get(...params) as { n: number }).n)
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, filter.pageSize ?? 20)
  const rows = db
    .prepare(`SELECT id FROM orders ${whereSql} ORDER BY placed_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as Row[]
  return { orders: rows.map((r) => getOrderById(String(r.id))!), total }
}

export function userHasPurchasedProduct(userId: string, productId: string): boolean {
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
         WHERE o.user_id = ? AND i.product_id = ? AND o.payment_status = 'PAID' LIMIT 1`,
      )
      .get(userId, productId),
  )
}

// ── payments + webhook ledger ───────────────────────────────────────────

export function insertPayment(input: {
  orderId: string; provider: string; intentId: string; amountCents: number; currency: string
}): void {
  getDb()
    .prepare(
      `INSERT INTO payments (id, order_id, provider, intent_id, amount_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), input.orderId, input.provider, input.intentId, input.amountCents, input.currency)
}

export function updatePaymentStatus(provider: string, intentId: string, status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED'): void {
  getDb()
    .prepare(`UPDATE payments SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE provider = ? AND intent_id = ?`)
    .run(status, provider, intentId)
}

/** Used by the hosted pay page to resolve intent → order. */
export function findPaymentByIntent(intentId: string): { orderId: string; provider: string; status: string } | null {
  const r = getDb()
    .prepare('SELECT order_id, provider, status FROM payments WHERE intent_id = ?')
    .get(intentId) as { order_id: string; provider: string; status: string } | undefined
  return r ? { orderId: String(r.order_id), provider: String(r.provider), status: String(r.status) } : null
}

/**
 * Webhook idempotency: returns false when the (provider, event_id) pair was
 * already recorded — duplicate deliveries become no-ops, not double-fulfillments.
 */
export function recordPaymentEvent(input: {
  provider: string; eventId: string; orderId: string | null; type: string; payload: string
}): boolean {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO payment_events (id, provider, event_id, order_id, type, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), input.provider, input.eventId, input.orderId, input.type, input.payload)
  return result.changes > 0
}

export function markPaymentEventProcessed(provider: string, eventId: string, status: 'PROCESSED' | 'FAILED' | 'IGNORED'): void {
  getDb().prepare('UPDATE payment_events SET status = ? WHERE provider = ? AND event_id = ?').run(status, provider, eventId)
}

// ── coupons ─────────────────────────────────────────────────────────────

function mapCoupon(r: Row): Coupon {
  return {
    id: String(r.id),
    code: String(r.code),
    type: r.type as Coupon['type'],
    value: Number(r.value),
    minSubtotalCents: Number(r.min_subtotal_cents),
    startsAt: (r.starts_at as string) ?? null,
    endsAt: (r.ends_at as string) ?? null,
    maxRedemptions: (r.max_redemptions as number) ?? null,
    perUserLimit: Number(r.per_user_limit),
    active: Number(r.active) === 1,
  }
}

export function findCouponByCode(code: string): Coupon | null {
  const r = getDb().prepare('SELECT * FROM coupons WHERE code = ?').get(code) as Row | undefined
  return r ? mapCoupon(r) : null
}

export function listCoupons(): Coupon[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() as Row[]
  return rows.map((r) => ({
    ...mapCoupon(r),
    redemptionCount: Number(
      (db.prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ?').get(String(r.id)) as { n: number }).n,
    ),
  }))
}

export function upsertCoupon(input: Omit<Coupon, 'redemptionCount'>): Coupon {
  getDb()
    .prepare(
      `INSERT INTO coupons (id, code, type, value, min_subtotal_cents, starts_at, ends_at, max_redemptions, per_user_limit, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET code=excluded.code, type=excluded.type, value=excluded.value,
         min_subtotal_cents=excluded.min_subtotal_cents, starts_at=excluded.starts_at, ends_at=excluded.ends_at,
         max_redemptions=excluded.max_redemptions, per_user_limit=excluded.per_user_limit, active=excluded.active`,
    )
    .run(input.id, input.code, input.type, input.value, input.minSubtotalCents,
      input.startsAt, input.endsAt, input.maxRedemptions, input.perUserLimit, input.active ? 1 : 0)
  return input
}

export function deleteCoupon(id: string): void {
  getDb().prepare('DELETE FROM coupons WHERE id = ?').run(id)
}

export function countCouponRedemptions(couponId: string, userId: string | null): { total: number; byUser: number } {
  const db = getDb()
  const total = Number((db.prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ?').get(couponId) as { n: number }).n)
  const byUser = userId
    ? Number((db.prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?').get(couponId, userId) as { n: number }).n)
    : 0
  return { total, byUser }
}

export function recordCouponRedemption(couponId: string, userId: string | null, orderId: string): void {
  getDb()
    .prepare('INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id) VALUES (?, ?, ?, ?)')
    .run(newId(), couponId, userId, orderId)
}
