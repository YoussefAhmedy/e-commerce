'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Heart, Menu, Search, ShoppingBag, User as UserIcon, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SearchBar } from './search-bar'

interface HeaderUser {
  name: string
  role: string
  email: string
}

const NAV = [
  { href: '/catalog', label: 'Shop all' },
  { href: '/catalog?type=POSTER', label: 'Prints' },
  { href: '/catalog?type=FRAME', label: 'Frames' },
  { href: '/custom', label: 'Custom studio' },
] as const

export function HeaderClient({
  user,
  initialCartCount,
  initialUnread,
}: {
  user: HeaderUser | null
  initialCartCount: number
  initialUnread: number
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartCount, setCartCount] = useState(initialCartCount)
  const router = useRouter()

  // Local cart-count refresh after mutations (any component fires 'pq:cart').
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch('/api/v1/cart', { cache: 'no-store' })
        const json = await res.json()
        if (json?.ok) setCartCount(json.data.itemCount)
      } catch {
        /* keep old count */
      }
    }
    window.addEventListener('pq:cart', refresh)
    return () => window.removeEventListener('pq:cart', refresh)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="bg-ink py-1.5 text-center text-xs font-medium tracking-wide text-paper">
        <Sparkles size={12} className="mr-1.5 inline-block align-[-2px]" aria-hidden />
        Free shipping over $100 · Museum-grade archival printing
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button
          className="-ml-2 rounded-full p-2 text-ink-soft hover:bg-cream lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Menu size={20} aria-hidden />
        </button>

        <Link href="/" className="font-display text-[1.35rem] font-semibold tracking-tight">
          Printique
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          <button
            onClick={() => setSearchOpen((s) => !s)}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-expanded={searchOpen}
            className="rounded-full p-2.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink"
          >
            <Search size={19} aria-hidden />
          </button>

          {user && (
            <Link
              href={'/account/notifications' as never}
              aria-label={`Notifications${initialUnread > 0 ? ` (${initialUnread} unread)` : ''}`}
              className="relative rounded-full p-2.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink"
            >
              <Bell size={19} aria-hidden />
              {initialUnread > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-clay-600" aria-hidden />
              )}
            </Link>
          )}

          <Link
            href={'/wishlist' as never}
            aria-label="Wishlist"
            className="hidden rounded-full p-2.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink sm:block"
          >
            <Heart size={19} aria-hidden />
          </Link>

          <Link
            href={'/cart' as never}
            aria-label={`Cart (${cartCount} items)`}
            className="relative rounded-full p-2.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink"
          >
            <ShoppingBag size={19} aria-hidden />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay-600 px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <Link
              href={'/account' as never}
              className="ml-1 flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors hover:border-ink-faint"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-paper" aria-hidden>
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[7rem] truncate sm:block">{user.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link href={'/signin' as never} className="btn-secondary ml-1 !px-4 !py-1.5 text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Search drawer */}
      <div className={cn('overflow-hidden border-t border-line transition-all', searchOpen ? 'max-h-40' : 'max-h-0 border-t-0')}>
        <div className="mx-auto max-w-3xl px-4 py-3">
          <SearchBar
            autoFocus
            onNavigate={() => setSearchOpen(false)}
          />
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col bg-paper p-5 shadow-lift">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-xl font-semibold">Printique</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-full p-2 hover:bg-cream">
                <X size={20} aria-hidden />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as never}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-medium hover:bg-cream"
                >
                  {item.label}
                </Link>
              ))}
              <Link href={'/search' as never} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-base font-medium hover:bg-cream">
                Ask the assistant
              </Link>
              <Link href={'/support' as never} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-base font-medium hover:bg-cream">
                Support
              </Link>
            </nav>
            <div className="mt-auto border-t border-line pt-4">
              {user ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-soft">{user.email}</span>
                  <Link href={'/account' as never} onClick={() => setMenuOpen(false)} className="btn-secondary !py-1.5 text-sm">
                    <UserIcon size={15} aria-hidden /> Account
                  </Link>
                </div>
              ) : (
                <Link href={'/signin' as never} onClick={() => setMenuOpen(false)} className="btn-primary w-full">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
