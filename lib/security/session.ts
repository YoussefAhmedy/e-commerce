import { cookies } from 'next/headers'
import { sha256, newToken } from '@/lib/domain/ids'
import type { PublicUser } from '@/lib/db/types'
import * as users from '@/lib/db/repositories/users'

/**
 * Cookie sessions.
 *
 * The browser holds an opaque random token; the database stores only its
 * sha256 — a leaked database cannot be used to impersonate anyone.
 * Cookie flags: httpOnly, sameSite=lax, secure in production.
 */

export const SESSION_COOKIE = 'pq_session'
export const GUEST_CART_COOKIE = 'pq_cart'

interface CookieOptions {
  httpOnly: boolean
  sameSite: 'lax'
  secure: boolean
  path: string
}

function cookieOpts(maxAgeSeconds?: number): CookieOptions & { maxAge?: number } {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  }
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const user = users.findSessionUser(sha256(token))
  return user ? users.toPublicUser(user) : null
}

export async function establishSession(userId: string, meta: { ip?: string; userAgent?: string }): Promise<void> {
  const token = newToken(32)
  users.createSession(sha256(token), userId, meta)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, cookieOpts(60 * 60 * 24 * 30))
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) users.destroySession(sha256(token))
  jar.delete(SESSION_COOKIE)
}

export async function getGuestCartToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(GUEST_CART_COOKIE)?.value ?? null
}

export async function setGuestCartToken(token: string): Promise<void> {
  const jar = await cookies()
  jar.set(GUEST_CART_COOKIE, token, cookieOpts(60 * 60 * 24 * 90))
}

export async function clearGuestCartToken(): Promise<void> {
  const jar = await cookies()
  jar.delete(GUEST_CART_COOKIE)
}
