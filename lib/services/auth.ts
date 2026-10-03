import { env } from '@/lib/config/env'
import { AppError } from '@/lib/domain/errors'
import { newToken, sha256 } from '@/lib/domain/ids'
import * as users from '@/lib/db/repositories/users'
import { audit, claimUpload } from '@/lib/db/repositories/engagement'
import type { PublicUser } from '@/lib/db/types'
import { hashPassword, verifyPassword, DUMMY_HASH } from '@/lib/security/passwords'
import { destroyCurrentSession, establishSession } from '@/lib/security/session'
import { destroyAllUserSessions } from '@/lib/db/repositories/users'
import { enqueueTemplatedEmail } from '@/lib/providers/email/queue'
import { mergeGuestCartIntoUser } from './cart'

/**
 * Auth service — registration, login (with lockout), sessions,
 * email verification and password reset. Everything security-relevant
 * is audited; nothing security-relevant is logged.
 */

export async function register(input: { name: string; email: string; password: string; ip?: string; userAgent?: string }): Promise<PublicUser> {
  const email = input.email.toLowerCase().trim()
  if (users.findUserByEmail(email)) {
    // Deliberately vague — don't disclose account existence.
    throw new AppError('CONFLICT', 'An account with this email already exists. Try signing in instead.')
  }
  const passwordHash = await hashPassword(input.password)
  const user = users.createUser({ email, name: input.name.trim(), passwordHash })

  await establishSession(user.id, { ip: input.ip, userAgent: input.userAgent })
  await mergeGuestCartIntoUser(user.id)

  enqueueTemplatedEmail(email, 'WELCOME', { name: user.name })
  await sendVerificationEmail(user.id, email, user.name)
  audit({ actorId: user.id, action: 'REGISTER', entity: 'user', entityId: user.id, ip: input.ip })

  return users.toPublicUser(user)
}

export async function sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
  const token = newToken(24)
  users.createAuthToken('VERIFY_EMAIL', userId, sha256(token), 60 * 24)
  const verifyUrl = `${env.SITE_URL}/api/v1/auth/verify-email?token=${token}`
  enqueueTemplatedEmail(email, 'VERIFY_EMAIL', { name, verifyUrl })
  if (!env.isProd) {
    // Dev convenience: the console email provider logs the text preview.
    console.info(`[dev] verification link for ${email}: ${verifyUrl}`)
  }
}

export async function login(input: { email: string; password: string; ip?: string; userAgent?: string }): Promise<PublicUser> {
  const email = input.email.toLowerCase().trim()
  const user = users.findUserByEmail(email)

  // Uniform timing: verify against a dummy hash when the user doesn't exist.
  const hash = user?.passwordHash ?? DUMMY_HASH
  const ok = await verifyPassword(input.password, hash)

  if (!user) {
    audit({ actorId: null, action: 'LOGIN_FAILED', meta: { email }, ip: input.ip })
    throw new AppError('UNAUTHORIZED', 'Invalid email or password.')
  }
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    audit({ actorId: user.id, action: 'LOGIN_LOCKED', entity: 'user', entityId: user.id, ip: input.ip })
    throw new AppError('RATE_LIMITED', 'Too many failed attempts. Try again in about 15 minutes.')
  }
  if (!ok) {
    const { locked } = users.recordLoginFailure(user.id)
    audit({ actorId: user.id, action: 'LOGIN_FAILED', entity: 'user', entityId: user.id, ip: input.ip, meta: { locked } })
    throw new AppError('UNAUTHORIZED', locked ? 'Too many failed attempts. Try again in about 15 minutes.' : 'Invalid email or password.')
  }

  users.recordLoginSuccess(user.id)
  await establishSession(user.id, { ip: input.ip, userAgent: input.userAgent })
  await mergeGuestCartIntoUser(user.id)
  audit({ actorId: user.id, action: 'LOGIN', entity: 'user', entityId: user.id, ip: input.ip })
  return users.toPublicUser(user)
}

export async function logout(): Promise<void> {
  const jar = await destroyCurrentSession()
  return jar
}

export async function requestPasswordReset(input: { email: string; ip?: string }): Promise<void> {
  const email = input.email.toLowerCase().trim()
  const user = users.findUserByEmail(email)
  // Always succeed from the caller's perspective (no account enumeration).
  if (!user) return
  const token = newToken(24)
  users.createAuthToken('PASSWORD_RESET', user.id, sha256(token), 60)
  const resetUrl = `${env.SITE_URL}/reset-password?token=${token}`
  enqueueTemplatedEmail(email, 'PASSWORD_RESET', { resetUrl })
  if (!env.isProd) console.info(`[dev] password reset link for ${email}: ${resetUrl}`)
  audit({ actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', entity: 'user', entityId: user.id, ip: input.ip })
}

export async function resetPassword(input: { token: string; password: string; ip?: string }): Promise<void> {
  const user = users.consumeAuthToken('PASSWORD_RESET', sha256(input.token))
  if (!user) throw new AppError('VALIDATION', 'This reset link is invalid or has expired. Request a new one.')
  const passwordHash = await hashPassword(input.password)
  users.updateUser(user.id, { passwordHash })
  destroyAllUserSessions(user.id) // force re-sign-in on all devices
  enqueueTemplatedEmail(user.email, 'ACCOUNT_SECURITY', {
    name: user.name,
    what: 'Your password was just changed.',
  })
  audit({ actorId: user.id, action: 'PASSWORD_RESET_COMPLETED', entity: 'user', entityId: user.id, ip: input.ip })
}

export async function verifyEmailToken(token: string): Promise<PublicUser> {
  const user = users.consumeAuthToken('VERIFY_EMAIL', sha256(token))
  if (!user) throw new AppError('VALIDATION', 'This verification link is invalid or has expired.')
  users.updateUser(user.id, { emailVerifiedAt: new Date().toISOString() })
  audit({ actorId: user.id, action: 'EMAIL_VERIFIED', entity: 'user', entityId: user.id })
  return users.toPublicUser(user)
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = users.findUserById(userId)
  if (!user) throw new AppError('UNAUTHORIZED', 'Account not found.')
  const ok = await verifyPassword(current, user.passwordHash)
  if (!ok) throw new AppError('UNAUTHORIZED', 'Your current password is incorrect.')
  const passwordHash = await hashPassword(next)
  users.updateUser(userId, { passwordHash })
  destroyAllUserSessions(userId)
  await establishSession(userId, {})
  enqueueTemplatedEmail(user.email, 'ACCOUNT_SECURITY', {
    name: user.name,
    what: 'Your password was changed from your account settings.',
  })
  audit({ actorId: userId, action: 'PASSWORD_CHANGED', entity: 'user', entityId: userId })
}

/** Tie an anonymous upload to its owner after login (used by the configurator). */
export function claimGuestUpload(uploadId: string, userId: string): void {
  claimUpload(uploadId, userId)
}
