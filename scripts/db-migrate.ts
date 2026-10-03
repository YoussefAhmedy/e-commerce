#!/usr/bin/env tsx
/** Apply database migrations (schema is idempotent — safe to run anytime). */
import { getDb, migrate } from '../lib/db'

const db = getDb()
migrate()
const tables = (db.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get() as { n: number }).n
console.log(`✓ Migrations applied — ${tables} tables present.`)
