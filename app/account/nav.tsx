'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Heart, LayoutDashboard, LogOut, MapPin, Package, ShieldCheck, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const ITEMS = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/security', label: 'Security', icon: ShieldCheck },
] as const

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    window.dispatchEvent(new Event('pq:cart'))
    router.replace('/' as never)
    router.refresh()
  }

  return (
    <nav aria-label="Account" className="space-y-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href as never}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-cream hover:text-ink',
            )}
          >
            <Icon size={16} aria-hidden />
            {label}
          </Link>
        )
      })}
      {isAdmin && (
        <Link
          href={'/admin' as never}
          className="flex items-center gap-3 rounded-xl bg-clay-50 px-4 py-2.5 text-sm font-semibold text-clay-700 transition-colors hover:bg-clay-100"
        >
          <LayoutDashboard size={16} aria-hidden />
          Admin studio
        </Link>
      )}
      <button
        onClick={logout}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <LogOut size={16} aria-hidden />
        Sign out
      </button>
    </nav>
  )
}
