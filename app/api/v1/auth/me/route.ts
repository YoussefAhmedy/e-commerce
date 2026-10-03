import { api, ok } from '@/lib/http/api'
import { getSessionUser } from '@/lib/security/session'

export const GET = api(async () => {
  const user = await getSessionUser()
  return ok({ user })
})
