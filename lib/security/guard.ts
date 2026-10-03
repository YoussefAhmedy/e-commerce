import { AppError } from '@/lib/domain/errors'
import { getSessionUser } from './session'
import type { PublicUser } from '@/lib/db/types'

/**
 * Server-side authorization — the ONLY place trust is established.
 * Frontend route hiding is a UX nicety, never a security boundary.
 */

export async function requireUser(): Promise<PublicUser> {
  const user = await getSessionUser()
  if (!user) throw new AppError('UNAUTHORIZED', 'You need to sign in to do that.')
  return user
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'This action requires administrator access.')
  return user
}

export function userIp(request: Request): string | undefined {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim()
  return request.headers.get('x-real-ip') ?? undefined
}

/**
 * CSRF mitigation for mutating API routes: SameSite=lax cookies +
 * explicit Origin/Referer match against the request host. Throws FORBIDDEN
 * on cross-origin mutation attempts.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  if (!origin) return // non-browser clients (curl, webhooks) — CSRF relies on cookies
  try {
    const originHost = new URL(origin).host
    const requestHost = request.headers.get('x-forwarded-host') ?? new URL(request.url).host
    if (originHost !== requestHost) {
      throw new AppError('FORBIDDEN', 'Cross-origin form submission rejected.')
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('FORBIDDEN', 'Invalid origin header.')
  }
}
