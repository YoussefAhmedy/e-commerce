import { getDb } from '@/lib/db'
import { AppError } from '@/lib/domain/errors'

/**
 * Inventory guardrails. All mutations run inside withTransaction(BEGIN IMMEDIATE)
 * at the service layer, so concurrent checkouts serialize — no overselling.
 *
 * Model: available = stock - reserved.
 *  - order create → reserve (reserved += qty), unless stock is insufficient → 409
 *  - payment success → hard-sell (stock -= qty, reserved -= qty)
 *  - cancel / payment failure → release (reserved -= qty)
 */

export function reserveStock(variantId: string, quantity: number): void {
  const db = getDb()
  const result = db
    .prepare('UPDATE product_variants SET reserved = reserved + ? WHERE id = ? AND (stock - reserved) >= ?')
    .run(quantity, variantId, quantity)
  if (result.changes === 0) throw new AppError('INSUFFICIENT_STOCK', 'Not enough stock for one of your items.')
}

export function releaseStock(variantId: string, quantity: number): void {
  getDb()
    .prepare('UPDATE product_variants SET reserved = MAX(0, reserved - ?) WHERE id = ?')
    .run(quantity, variantId)
}

/** Converts reservations into sold stock. Idempotent per call-site (guarded by order FSM). */
export function sellReservedStock(items: Array<{ variantId: string | null; quantity: number }>): void {
  const db = getDb()
  for (const item of items) {
    if (!item.variantId) continue
    db.prepare(
      `UPDATE product_variants
       SET stock = MAX(0, stock - ?), reserved = MAX(0, reserved - ?)
       WHERE id = ?`,
    ).run(item.quantity, item.quantity, item.variantId)
  }
}
