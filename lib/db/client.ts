import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '@/lib/config/env'
import { migrations } from './migrations'

/**
 * Embedded SQLite database via node:sqlite (DatabaseSync).
 *
 * Why: zero-infrastructure local development, real ACID transactions,
 * and a clean repository seam (lib/db/repositories/*) so a Postgres
 * adapter can be introduced without touching domain code.
 *
 * Node 22 prints an experimental warning for node:sqlite — it is stable
 * from Node 24 onward (our Dockerfile and .nvmrc pin Node 24).
 */

export type DB = DatabaseSync

let instance: DB | null = null

function open(): DB {
  fs.mkdirSync(path.dirname(env.databasePath), { recursive: true })
  const db = new DatabaseSync(env.databasePath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA busy_timeout = 5000;')
  return db
}

/** Run pending migrations (CREATE TABLE IF NOT EXISTS + migration ledger). */
export function migrate(db: DB = getDb()): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`)
  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as Array<{ id: string }>).map((r) => r.id),
  )
  for (const m of migrations) {
    if (applied.has(m.id)) continue
    db.exec('BEGIN')
    try {
      db.exec(m.sql)
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(m.id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}

/** Lazily-opened, migrated singleton used by the app. */
export function getDb(): DB {
  if (!instance) {
    instance = open()
    migrate(instance)
  }
  return instance
}

/**
 * Test helper — an isolated database. Pass ':memory:' for pure memory tests.
 */
export function createTestDb(file = ':memory:'): DB {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

/** Close the singleton (used in tests / scripts). */
export function closeDb(): void {
  if (instance) {
    instance.close()
    instance = null
  }
}

/**
 * Run `fn` inside an IMMEDIATE transaction (write-intent lock up front —
 * prevents write-write races like concurrent stock decrements).
 * Nested calls reuse the outer transaction via savepoints.
 */
let txDepth = 0
export function withTransaction<T>(fn: () => T): T {
  const db = getDb()
  if (txDepth > 0) {
    const name = `sp_${txDepth}`
    db.exec(`SAVEPOINT ${name}`)
    try {
      const result = fn()
      db.exec(`RELEASE SAVEPOINT ${name}`)
      return result
    } catch (err) {
      db.exec(`ROLLBACK TO SAVEPOINT ${name}`)
      db.exec(`RELEASE SAVEPOINT ${name}`)
      throw err
    }
  }
  db.exec('BEGIN IMMEDIATE')
  txDepth++
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  } finally {
    txDepth--
  }
}
