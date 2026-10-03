import { api, ok, parseJson } from '@/lib/http/api'
import { updateProfileSchema } from '@/lib/validation/schemas'
import { requireUser, assertSameOrigin } from '@/lib/security/guard'
import { updateUser, toPublicUser, findUserById } from '@/lib/db/repositories/users'
import { audit } from '@/lib/db/repositories/engagement'
import { AppError } from '@/lib/domain/errors'

export const PATCH = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const input = await parseJson(request, updateProfileSchema)
  updateUser(user.id, { name: input.name })
  audit({ actorId: user.id, action: 'PROFILE_UPDATED', entity: 'user', entityId: user.id })
  const fresh = findUserById(user.id)
  if (!fresh) throw new AppError('INTERNAL', 'Account lookup failed.')
  return ok({ user: toPublicUser(fresh) })
})
