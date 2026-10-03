import { api, ok, parseJson } from '@/lib/http/api'
import { registerSchema } from '@/lib/validation/schemas'
import { register } from '@/lib/services/auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`register:${ip}`, 20, 3600)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', `Too many attempts — retry in ${limit.retryAfterSeconds}s.`)

  const input = await parseJson(request, registerSchema)
  const user = await register({ ...input, ip, userAgent: request.headers.get('user-agent') ?? undefined })
  return ok({ user }, { status: 201 })
})
