import { api, ok } from '@/lib/http/api'
import { logout } from '@/lib/services/auth'
import { assertSameOrigin } from '@/lib/security/guard'

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  await logout()
  return ok({ signedOut: true })
})
