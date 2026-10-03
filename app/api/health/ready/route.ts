import { NextResponse } from 'next/server'
import { api, ok } from '@/lib/http/api'
import { getDb } from '@/lib/db'
import { log } from '@/lib/observability/logger'

/** Readiness — the app AND its critical dependency (the database). */
export const GET = api(async () => {
  try {
    const row = getDb().prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }
    return ok({ status: 'ready', database: 'up', products: row.n })
  } catch (err) {
    log.error('readiness check failed', { error: String(err) })
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Database not reachable.' } },
      { status: 503 },
    )
  }
})
