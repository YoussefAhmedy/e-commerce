import { getDb, newId } from '@/lib/db'
import type { Notification, Review, Upload } from '@/lib/db/types'

/** Engagement repositories: reviews, wishlist, notifications, audit, analytics, uploads, email log. */

type Row = Record<string, unknown>

// ── reviews ─────────────────────────────────────────────────────────────

function mapReview(r: Row): Review {
  return {
    id: String(r.id),
    productId: String(r.product_id),
    userId: String(r.user_id),
    userName: String(r.user_name ?? 'Customer'),
    rating: Number(r.rating),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    status: r.status as Review['status'],
    verifiedPurchase: Number(r.verified_purchase) === 1,
    createdAt: String(r.created_at),
  }
}

export function listProductReviews(productId: string, limit = 20): Review[] {
  const rows = getDb()
    .prepare(
      `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? AND r.status = 'APPROVED' ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(productId, limit) as Row[]
  return rows.map(mapReview)
}

export function listPendingReviews(): Review[] {
  const rows = getDb()
    .prepare(
      `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'PENDING' ORDER BY r.created_at ASC`,
    )
    .all() as Row[]
  return rows.map(mapReview)
}

export function countPendingReviews(): number {
  return Number((getDb().prepare(`SELECT COUNT(*) AS n FROM reviews WHERE status = 'PENDING'`).get() as { n: number }).n)
}

export function createReview(input: {
  productId: string; userId: string; rating: number; title: string; body: string
  status: Review['status']; verifiedPurchase: boolean
}): 'CREATED' | 'DUPLICATE' {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO reviews (id, product_id, user_id, rating, title, body, status, verified_purchase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), input.productId, input.userId, input.rating, input.title, input.body,
      input.status, input.verifiedPurchase ? 1 : 0)
  return result.changes > 0 ? 'CREATED' : 'DUPLICATE'
}

export function moderateReview(reviewId: string, status: 'APPROVED' | 'REJECTED'): void {
  getDb().prepare(`UPDATE reviews SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(status, reviewId)
}

// ── wishlist ────────────────────────────────────────────────────────────

export function toggleWishlist(userId: string, productId: string): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?').get(userId, productId) as Row | undefined
  if (existing) {
    db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(String(existing.id))
    return false
  }
  db.prepare('INSERT INTO wishlist_items (id, user_id, product_id) VALUES (?, ?, ?)').run(newId(), userId, productId)
  return true
}

export function listWishlistProductIds(userId: string): string[] {
  const rows = getDb().prepare('SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Row[]
  return rows.map((r) => String(r.product_id))
}

// ── notifications ───────────────────────────────────────────────────────

function mapNotification(r: Row): Notification {
  let data: Record<string, string> = {}
  try { data = JSON.parse(String(r.data ?? '{}')) } catch { /* ignore */ }
  return {
    id: String(r.id),
    userId: String(r.user_id),
    type: String(r.type),
    title: String(r.title),
    body: String(r.body ?? ''),
    data,
    readAt: (r.read_at as string) ?? null,
    createdAt: String(r.created_at),
  }
}

export function createNotification(input: { userId: string; type: string; title: string; body?: string; data?: Record<string, string> }): void {
  getDb()
    .prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)')
    .run(newId(), input.userId, input.type, input.title, input.body ?? '', JSON.stringify(input.data ?? {}))
}

export function listNotifications(userId: string, limit = 20): Notification[] {
  const rows = getDb()
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as Row[]
  return rows.map(mapNotification)
}

export function unreadNotificationCount(userId: string): number {
  return Number((getDb().prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId) as { n: number }).n)
}

export function markAllNotificationsRead(userId: string): void {
  getDb().prepare(`UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND read_at IS NULL`).run(userId)
}

// ── audit log ───────────────────────────────────────────────────────────

export function audit(input: {
  actorId: string | null; action: string; entity?: string; entityId?: string
  meta?: Record<string, unknown>; ip?: string
}): void {
  getDb()
    .prepare('INSERT INTO audit_log (id, actor_id, action, entity, entity_id, meta, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), input.actorId, input.action, input.entity ?? null, input.entityId ?? null,
      JSON.stringify(input.meta ?? {}), input.ip ?? null)
}

export function listAuditLog(limit = 100): Array<Record<string, string | null>> {
  const rows = getDb().prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit) as Row[]
  return rows.map((r) => ({
    id: String(r.id), actorId: (r.actor_id as string) ?? null, action: String(r.action),
    entity: (r.entity as string) ?? null, entityId: (r.entity_id as string) ?? null,
    meta: String(r.meta ?? '{}'), ip: (r.ip as string) ?? null, createdAt: String(r.created_at),
  }))
}

// ── analytics ───────────────────────────────────────────────────────────

export type AnalyticsType = 'PRODUCT_VIEW' | 'ADD_TO_CART' | 'SEARCH' | 'PURCHASE'

export function trackEvent(type: AnalyticsType, input: { productId?: string; userId?: string; sessionId?: string; meta?: Record<string, string> }): void {
  getDb()
    .prepare('INSERT INTO analytics_events (id, type, product_id, user_id, session_id, meta) VALUES (?, ?, ?, ?, ?, ?)')
    .run(newId(), type, input.productId ?? null, input.userId ?? null, input.sessionId ?? null, JSON.stringify(input.meta ?? {}))
}

export function analyticsSummary(sinceDays = 30): {
  views: number; addToCarts: number; searches: number
  topProducts: Array<{ productId: string; views: number }>
} {
  const db = getDb()
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString()
  const count = (type: AnalyticsType) =>
    Number((db.prepare('SELECT COUNT(*) AS n FROM analytics_events WHERE type = ? AND created_at >= ?').get(type, since) as { n: number }).n)
  const topRows = db
    .prepare(
      `SELECT product_id, COUNT(*) AS views FROM analytics_events
       WHERE type = 'PRODUCT_VIEW' AND product_id IS NOT NULL AND created_at >= ?
       GROUP BY product_id ORDER BY views DESC LIMIT 5`,
    )
    .all(since) as Array<{ product_id: string; views: number }>
  return {
    views: count('PRODUCT_VIEW'),
    addToCarts: count('ADD_TO_CART'),
    searches: count('SEARCH'),
    topProducts: topRows.map((r) => ({ productId: String(r.product_id), views: Number(r.views) })),
  }
}

// ── uploads ─────────────────────────────────────────────────────────────

export function createUpload(input: Omit<Upload, 'id' | 'createdAt'>): Upload {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO uploads (id, owner_user_id, storage_key, mime, size_bytes, width, height, original_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.ownerUserId, input.storageKey, input.mime, input.sizeBytes, input.width, input.height, input.originalName)
  return { ...input, id, createdAt: new Date().toISOString() }
}

export function getUpload(id: string): Upload | null {
  const r = getDb().prepare('SELECT * FROM uploads WHERE id = ?').get(id) as Row | undefined
  if (!r) return null
  return mapUpload(r)
}

export function getUploadByKey(storageKey: string): Upload | null {
  const r = getDb().prepare('SELECT * FROM uploads WHERE storage_key = ?').get(storageKey) as Row | undefined
  if (!r) return null
  return mapUpload(r)
}

export function claimUpload(uploadId: string, userId: string): void {
  getDb().prepare('UPDATE uploads SET owner_user_id = ? WHERE id = ? AND owner_user_id IS NULL').run(userId, uploadId)
}

function mapUpload(r: Row): Upload {
  return {
    id: String(r.id),
    ownerUserId: (r.owner_user_id as string) ?? null,
    storageKey: String(r.storage_key),
    mime: String(r.mime),
    sizeBytes: Number(r.size_bytes),
    width: (r.width as number) ?? null,
    height: (r.height as number) ?? null,
    originalName: String(r.original_name ?? ''),
    createdAt: String(r.created_at),
  }
}

// ── email log (queue) ───────────────────────────────────────────────────

export function enqueueEmail(input: { to: string; template: string; subject: string; payload: Record<string, unknown> }): string {
  const id = newId()
  getDb()
    .prepare('INSERT INTO email_log (id, to_addr, template, subject, payload) VALUES (?, ?, ?, ?, ?)')
    .run(id, input.to, input.template, input.subject, JSON.stringify(input.payload))
  return id
}

export function nextQueuedEmails(limit = 10): Array<{ id: string; to: string; template: string; subject: string; payload: string; attempts: number }> {
  const rows = getDb()
    .prepare(
      `SELECT * FROM email_log
       WHERE status = 'QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ORDER BY created_at LIMIT ?`,
    )
    .all(limit) as Row[]
  return rows.map((r) => ({
    id: String(r.id), to: String(r.to_addr), template: String(r.template), subject: String(r.subject),
    payload: String(r.payload ?? '{}'), attempts: Number(r.attempts ?? 0),
  }))
}

export function markEmailSent(id: string): void {
  getDb().prepare(`UPDATE email_log SET status = 'SENT', sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), attempts = attempts + 1 WHERE id = ?`).run(id)
}

/** Exponential backoff retry; gives up (FAILED) after 5 attempts. */
export function markEmailFailed(id: string, error: string, attempts: number): void {
  const db = getDb()
  const nextAttempts = attempts + 1
  if (nextAttempts >= 5) {
    db.prepare(`UPDATE email_log SET status = 'FAILED', error = ?, attempts = ? WHERE id = ?`).run(error, nextAttempts, id)
  } else {
    const delaySec = Math.min(3600, 30 * 2 ** attempts)
    const nextAt = new Date(Date.now() + delaySec * 1000).toISOString()
    db.prepare(`UPDATE email_log SET error = ?, attempts = ?, next_attempt_at = ? WHERE id = ?`).run(error, nextAttempts, nextAt, id)
  }
}

// ── settings ────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const r = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return r?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}
