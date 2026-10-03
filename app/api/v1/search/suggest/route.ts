import { api, ok } from '@/lib/http/api'
import { suggest } from '@/lib/services/catalog'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'

/** Typeahead — fast prefix search, limited payload, rate-limited. */
export const GET = api(async (request: Request) => {
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`suggest:${ip}`, 60, 60)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many requests.')

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  return ok({ suggestions: suggest(q) })
})
