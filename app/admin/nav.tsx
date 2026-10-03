'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BadgePercent, ClipboardList, FolderTree, LayoutDashboard, Package,
  ScrollText, Sparkles, Star, Store, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/ai-tools', label: 'AI tools', icon: Sparkles },
  { href: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
] as const

export function AdminNav() {
  const pathname = usePathname()
  return (
    <div>
      <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-ink-faint">Admin studio</p>
      <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1" aria-label="Admin">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href as never}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-white hover:text-ink',
              )}
            >
              <Icon size={16} aria-hidden />
              {label}
            </Link>
          )
        })}
        <Link href={'/' as never} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-clay-700 hover:bg-clay-50">
          <Store size={16} aria-hidden />
          Back to store
        </Link>
      </nav>
    </div>
  )
}
