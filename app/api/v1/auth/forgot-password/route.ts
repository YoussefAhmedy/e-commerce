import { api, ok, parseJson } from '@/lib/http/api'
import { forgotPasswordSchema } from '@/lib/validation/schemas'
import { requestPasswordReset } from '@/lib/services/auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`forgot:${ip}`, 5, 900)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', `Please wait ${Math.ceil(limit.retryAfterSeconds / 60)} min before requesting another reset.`)

  const { email } = await parseJson(request, forgotPasswordSchema)
  await requestPasswordReset({ email, ip })
  // Deliberately uniform response — no account enumeration.
  return ok({ message: 'If an account exists for that email, a reset link is on its way.' })
})
