import { getDb, newId } from '@/lib/db'
import type { Address, AddressInput, PublicUser, User } from '@/lib/db/types'
import { commerce } from '@/lib/config/commerce'

/** Users, sessions, auth tokens and saved addresses. */

type Row = Record<string, unknown>

function mapUser(r: Row): User {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    passwordHash: String(r.password_hash),
    role: r.role as User['role'],
    emailVerifiedAt: (r.email_verified_at as string) ?? null,
    failedLogins: Number(r.failed_logins ?? 0),
    lockedUntil: (r.locked_until as string) ?? null,
    createdAt: String(r.created_at),
  }
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    emailVerifiedAt: u.emailVerifiedAt,
  }
}

export function findUserByEmail(email: string): User | null {
  const r = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as Row | undefined
  return r ? mapUser(r) : null
}

export function findUserById(id: string): User | null {
  const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined
  return r ? mapUser(r) : null
}

export function createUser(input: { email: string; name: string; passwordHash: string; role?: User['role']; emailVerified?: boolean }): User {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, role, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.email.toLowerCase(), input.name, input.passwordHash, input.role ?? 'CUSTOMER',
      input.emailVerified ? new Date().toISOString() : null)
  return findUserById(id)!
}

export function updateUser(id: string, patch: { name?: string; emailVerifiedAt?: string | null; passwordHash?: string }): void {
  const db = getDb()
  if (patch.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(patch.name, id)
  if (patch.emailVerifiedAt !== undefined) db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(patch.emailVerifiedAt, id)
  if (patch.passwordHash !== undefined) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(patch.passwordHash, id)
}

export function recordLoginFailure(id: string): { locked: boolean } {
  const db = getDb()
  db.prepare(`UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ?`).run(id)
  const u = findUserById(id)!
  // Progressive lockout: 5+ failures → 15 minute lock.
  if (u.failedLogins >= 5) {
    const until = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    db.prepare(`UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?`).run(until, id)
    return { locked: true }
  }
  return { locked: false }
}

export function recordLoginSuccess(id: string): void {
  getDb().prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(id)
}

export function listUsers(limit = 100, offset = 0): Array<PublicUser & { orderCount: number; totalSpentCents: number; createdAt: string }> {
  const rows = getDb()
    .prepare(
      `SELECT u.*,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'CANCELLED') AS order_count,
        (SELECT COALESCE(SUM(o.total_cents),0) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'PAID') AS spent
       FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Row[]
  return rows.map((r) => ({
    ...toPublicUser(mapUser(r)),
    orderCount: Number(r.order_count),
    totalSpentCents: Number(r.spent),
    createdAt: String(r.created_at),
  }))
}

export function countUsers(): number {
  return Number((getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n)
}

// ── sessions ────────────────────────────────────────────────────────────

export function createSession(sessionIdHash: string, userId: string, meta: { ip?: string; userAgent?: string }): void {
  const expires = new Date(Date.now() + commerce.sessionTtlSeconds * 1000).toISOString()
  getDb()
    .prepare('INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
    .run(sessionIdHash, userId, expires, meta.ip ?? null, meta.userAgent ?? null)
}

export function findSessionUser(sessionIdHash: string): User | null {
  const db = getDb()
  const r = db
    .prepare(`SELECT s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(sessionIdHash) as (Row & { expires_at: string }) | undefined
  if (!r) return null
  if (new Date(String(r.expires_at)) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionIdHash)
    return null
  }
  return mapUser(r)
}

export function destroySession(sessionIdHash: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionIdHash)
}

export function destroyAllUserSessions(userId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

// ── auth tokens (email verification / password reset) ───────────────────

export function createAuthToken(purpose: 'VERIFY_EMAIL' | 'PASSWORD_RESET', userId: string, tokenHash: string, ttlMinutes: number): void {
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()
  // Single outstanding token per purpose — older ones are voided.
  getDb().prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?').run(userId, purpose)
  getDb()
    .prepare('INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(newId(), userId, purpose, tokenHash, expires)
}

export function consumeAuthToken(purpose: 'VERIFY_EMAIL' | 'PASSWORD_RESET', tokenHash: string): User | null {
  const db = getDb()
  const r = db
    .prepare(`SELECT * FROM auth_tokens WHERE purpose = ? AND token_hash = ? AND consumed_at IS NULL`)
    .get(purpose, tokenHash) as Row | undefined
  if (!r) return null
  if (new Date(String(r.expires_at)) < new Date()) return null
  db.prepare(`UPDATE auth_tokens SET consumed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(String(r.id))
  return findUserById(String(r.user_id))
}

// ── addresses ───────────────────────────────────────────────────────────

export function listAddresses(userId: string): Address[] {
  const rows = getDb().prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(userId) as Row[]
  return rows.map(mapAddress)
}

function mapAddress(r: Row): Address {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    label: String(r.label ?? 'Home'),
    firstName: String(r.first_name),
    lastName: String(r.last_name),
    line1: String(r.line1),
    line2: (r.line2 as string) ?? undefined,
    city: String(r.city),
    state: (r.state as string) ?? undefined,
    postalCode: String(r.postal_code),
    country: String(r.country),
    phone: (r.phone as string) ?? undefined,
    isDefault: Number(r.is_default) === 1,
  }
}

export function createAddress(userId: string, input: AddressInput & { label?: string; isDefault?: boolean }): Address {
  const db = getDb()
  const id = newId()
  if (input.isDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId)
  db.prepare(
    `INSERT INTO addresses (id, user_id, label, first_name, last_name, line1, line2, city, state, postal_code, country, phone, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, input.label ?? 'Home', input.firstName, input.lastName, input.line1, input.line2 ?? null,
    input.city, input.state ?? null, input.postalCode, input.country, input.phone ?? null, input.isDefault ? 1 : 0)
  return listAddresses(userId).find((a) => a.id === id)!
}

export function deleteAddress(userId: string, addressId: string): void {
  getDb().prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addressId, userId)
}
