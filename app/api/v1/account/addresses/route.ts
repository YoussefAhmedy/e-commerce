import { z } from 'zod'
import { api, ok, parseJson } from '@/lib/http/api'
import { addressSchema } from '@/lib/validation/schemas'
import { requireUser, assertSameOrigin } from '@/lib/security/guard'
import { createAddress, deleteAddress, listAddresses } from '@/lib/db/repositories/users'
import { AppError } from '@/lib/domain/errors'

const createSchema = addressSchema.extend({
  label: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
})

export const GET = api(async () => {
  const user = await requireUser()
  return ok({ addresses: listAddresses(user.id) })
})

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const input = await parseJson(request, createSchema)
  const address = createAddress(user.id, { ...input, label: input.label ?? 'Home', isDefault: input.isDefault })
  return ok({ address }, { status: 201 })
})

export const DELETE = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await requireUser()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) throw new AppError('VALIDATION', 'Address id is required.')
  deleteAddress(user.id, id)
  return ok({ deleted: true })
})
