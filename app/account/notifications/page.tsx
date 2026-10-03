import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/security/session'
import { listNotifications } from '@/lib/db/repositories/engagement'
import { NotificationsClient } from './notifications-client'

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = (await getSessionUser())!
  const notifications = listNotifications(user.id, 30)
  return <NotificationsClient initialNotifications={notifications} />
}
