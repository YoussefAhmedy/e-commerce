import { api, ok } from '@/lib/http/api'
import { requireUser, assertSameOrigin } from '@/lib/security/guard'
import { listNotifications, markAllNotificationsRead, unreadNotificationCount } from '@/lib/db/repositories/engagement'

export const GET = api(async () => {
  const user = await requireUser()
  return ok({
    notifications: listNotifications(user.id),
    unread: unreadNotificationCount(user.id),
  })
})

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const user = await requireUser()
  markAllNotificationsRead(user.id)
  return ok({ unread: 0 })
})
