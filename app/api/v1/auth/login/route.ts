import { api, ok, parseJson } from '@/lib/http/api'
import { loginSchema } from '@/lib/validation/schemas'
import { login } from '@/lib/services/auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`login:${ip}`, 10, 900) // 10 per 15 min per IP
  if (!limit.allowed) throw new AppError('RATE_LIMITED', `Too many sign-in attempts — retry in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`)

  const input = await parseJson(request, loginSchema)
  const user = await login({ ...input, ip, userAgent: request.headers.get('user-agent') ?? undefined })
  return ok({ user })
})
