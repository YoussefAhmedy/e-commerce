import { z } from 'zod'
import { api, ok, parseJson } from '@/lib/http/api'
import { passwordSchema } from '@/lib/validation/schemas'
import { requireUser, assertSameOrigin } from '@/lib/security/guard'
import { changePassword } from '@/lib/services/auth'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
})

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const input = await parseJson(request, changePasswordSchema)
  await changePassword(user.id, input.currentPassword, input.newPassword)
  return ok({ message: 'Password updated.' })
})
