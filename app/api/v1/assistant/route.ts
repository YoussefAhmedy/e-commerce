import { api, ok, parseJson } from '@/lib/http/api'
import { assistantMessageSchema } from '@/lib/validation/schemas'
import { runAssistant } from '@/lib/services/assistant'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { AppError } from '@/lib/domain/errors'
import { env } from '@/lib/config/env'
import { getSessionUser } from '@/lib/security/session'

/**
 * AI shopping assistant — grounded in the catalog via server-side tools.
 * Rate limited per identity (user id when signed in, IP otherwise).
 */
export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await getSessionUser()
  const identity = user?.id ?? (userIp(request) ?? 'unknown')
  const limit = checkRateLimit(`assistant:${identity}`, env.AI_RATE_LIMIT, 3600)
  if (!limit.allowed) {
    throw new AppError('RATE_LIMITED', `You've reached the assistant limit — try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`)
  }

  const input = await parseJson(request, assistantMessageSchema)
  const reply = await runAssistant(input.message, input.thread)
  return ok(reply)
})
