import { getSessionUser } from '@/lib/security/session'
import { resolveCart } from '@/lib/services/cart'
import { unreadNotificationCount } from '@/lib/db/repositories/engagement'
import { HeaderClient } from './header-client'

export async function SiteHeader() {
  const user = await getSessionUser()
  let cartCount = 0
  try {
    const { cart } = await resolveCart()
    cartCount = cart.lines.reduce((n, l) => n + l.quantity, 0)
  } catch {
    cartCount = 0
  }
  const unread = user ? unreadNotificationCount(user.id) : 0

  return <HeaderClient user={user ? { name: user.name, role: user.role, email: user.email } : null} initialCartCount={cartCount} initialUnread={unread} />
}
