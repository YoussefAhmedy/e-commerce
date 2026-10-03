#!/usr/bin/env tsx
/** Drop ALL data and re-apply schema. Dev-only escape hatch. */
import { statSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), '.data')
const dbFile = join(dataDir, 'printique.db')

try {
  statSync(dbFile)
  rmSync(dbFile, { force: true })
  rmSync(`${dbFile}-wal`, { force: true })
  rmSync(`${dbFile}-shm`, { force: true })
  console.log(`✓ Deleted ${dbFile}`)
} catch {
  console.log('ℹ No database file found — nothing to delete.')
}
console.log('Run `npm run db:migrate && npm run db:seed` to rebuild.')
