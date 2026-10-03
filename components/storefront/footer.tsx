import Link from 'next/link'
import { site } from '@/lib/config/site'

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/catalog', label: 'All products' },
      { href: '/catalog?type=POSTER', label: 'Art prints' },
      { href: '/catalog?type=FRAME', label: 'Frames' },
      { href: '/custom', label: 'Custom studio' },
      { href: '/wishlist', label: 'Wishlist' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/account', label: 'Overview' },
      { href: '/account/orders', label: 'Orders' },
      { href: '/account/notifications', label: 'Notifications' },
      { href: '/signin', label: 'Sign in' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/support', label: 'Support & contact' },
      { href: '/shipping', label: 'Shipping policy' },
      { href: '/refunds', label: 'Refund policy' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-cream/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-xl font-semibold">{site.name}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            {site.description}
          </p>
          <p className="mt-6 text-xs text-ink-faint">© {new Date().getFullYear()} {site.legalName}. All rights reserved.</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href as never} className="text-sm text-ink-soft transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  )
}
