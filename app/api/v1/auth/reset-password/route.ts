import { api, ok, parseJson } from '@/lib/http/api'
import { resetPasswordSchema } from '@/lib/validation/schemas'
import { resetPassword } from '@/lib/services/auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`reset:${ip}`, 10, 900)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many attempts. Try again later.')

  const input = await parseJson(request, resetPasswordSchema)
  await resetPassword({ ...input, ip })
  return ok({ message: 'Password updated. You can sign in with your new password.' })
})
