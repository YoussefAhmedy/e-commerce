import { getDb } from '@/lib/db'

/** Admin analytics — every metric answers a decision, not a vanity chart. */

export interface DashboardMetrics {
  period: string
  revenueCents: number
  paidOrders: number
  averageOrderValueCents: number
  pendingOrders: number
  openPayments: number
  customers: number
  unitsSold: number
  conversion: { views: number; purchases: number; rate: number | null }
  revenueByDay: Array<{ day: string; revenueCents: number }>
  topProducts: Array<{ productId: string | null; name: string; units: number; revenueCents: number }>
  ordersByStatus: Array<{ label: string; count: number }>
}

export function dashboardMetrics(days = 30): DashboardMetrics {
  const db = getDb()
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const one = (sql: string, ...params: string[]) =>
    Number((db.prepare(sql).get(...params) as { n: number } | undefined)?.n ?? 0)

  const revenueCents = one(
    `SELECT COALESCE(SUM(total_cents),0) AS n FROM orders WHERE payment_status = 'PAID' AND placed_at >= ?`,
    since,
  )
  const paidOrders = one(`SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'PAID' AND placed_at >= ?`, since)
  const pendingOrders = one(`SELECT COUNT(*) AS n FROM orders WHERE status = 'CONFIRMED' AND fulfillment_status IN ('UNFULFILLED','PROCESSING')`)
  const openPayments = one(`SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'PENDING' AND status = 'PENDING'`)
  const customers = one(`SELECT COUNT(*) AS n FROM users WHERE role = 'CUSTOMER'`)
  const unitsSold = one(
    `SELECT COALESCE(SUM(i.quantity),0) AS n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.payment_status = 'PAID' AND o.placed_at >= ?`,
    since,
  )
  const views = one(`SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'PRODUCT_VIEW' AND created_at >= ?`, since)
  const purchases = one(`SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'PURCHASE' AND created_at >= ?`, since)

  const revenueByDay = (
    db.prepare(
      `SELECT date(placed_at) AS day, COALESCE(SUM(total_cents),0) AS cents
       FROM orders WHERE payment_status = 'PAID' AND placed_at >= ?
       GROUP BY date(placed_at) ORDER BY day`,
    ).all(since) as Array<{ day: string; cents: number }>
  ).map((r) => ({ day: String(r.day), revenueCents: Number(r.cents) }))

  const topProducts = (
    db.prepare(
      `SELECT i.product_id, i.name, SUM(i.quantity) AS units, SUM(i.line_total_cents) AS cents
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.payment_status = 'PAID' AND o.placed_at >= ?
       GROUP BY i.product_id, i.name ORDER BY cents DESC LIMIT 5`,
    ).all(since) as Array<{ product_id: string | null; name: string; units: number; cents: number }>
  ).map((r) => ({
    productId: r.product_id,
    name: String(r.name),
    units: Number(r.units),
    revenueCents: Number(r.cents),
  }))

  const ordersByStatus = (
    db.prepare(
      `SELECT payment_status || ' / ' || fulfillment_status AS label, COUNT(*) AS n
       FROM orders WHERE status != 'CANCELLED' GROUP BY payment_status, fulfillment_status ORDER BY n DESC LIMIT 6`,
    ).all() as Array<{ label: string; n: number }>
  ).map((r) => ({ label: String(r.label).toLowerCase().replaceAll('_', ' '), count: Number(r.n) }))

  return {
    period: `${days}d`,
    revenueCents,
    paidOrders,
    averageOrderValueCents: paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0,
    pendingOrders,
    openPayments,
    customers,
    unitsSold,
    conversion: { views, purchases, rate: views > 0 ? purchases / views : null },
    revenueByDay,
    topProducts,
    ordersByStatus,
  }
}
