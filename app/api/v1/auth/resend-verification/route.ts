import { api, ok } from '@/lib/http/api'
import { sendVerificationEmail } from '@/lib/services/auth'
import { requireUser, userIp } from '@/lib/security/guard'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/domain/errors'

/**
 * POST /api/v1/auth/resend-verification — re-send the verification email.
 * Authenticated only; rate-limited; no-op if already verified (uniform response).
 */
export const POST = api(async (request: Request) => {
  const user = await requireUser()
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`resend-verification:${user.id}:${ip}`, 3, 3600)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Verification email recently sent — check your inbox first.')

  if (!user.emailVerifiedAt) {
    await sendVerificationEmail(user.id, user.email, user.name)
  }
  return ok({ sent: !user.emailVerifiedAt })
})
