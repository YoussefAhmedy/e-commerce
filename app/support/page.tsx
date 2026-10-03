import type { Metadata } from 'next'
import Link from 'next/link'
import { LifeBuoy, Mail, Package, RefreshCcw, Truck } from 'lucide-react'
import { site } from '@/lib/config/site'

export const metadata: Metadata = {
  title: 'Support & contact',
  description: 'Get help with orders, payments, custom prints and framing.',
  alternates: { canonical: '/support' },
}

const TOPICS = [
  { icon: Package, title: 'Order issues', body: 'Track, change or cancel a pending order from your account — or write to us with the order number.', href: '/account/orders', link: 'My orders' },
  { icon: Truck, title: 'Delivery', body: 'Transit takes 3–7 business days after production (2–4 days). Every parcel is tracked.', href: '/shipping', link: 'Shipping policy' },
  { icon: RefreshCcw, title: 'Returns & refunds', body: 'Custom prints are made to order, but if something arrives damaged we make it right.', href: '/refunds', link: 'Refund policy' },
  { icon: LifeBuoy, title: 'Custom studio help', body: 'Resolution guidance, color profiles and crop advice for your uploads.', href: '/custom', link: 'Open the studio' },
] as const

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="max-w-xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">How can we help?</h1>
        <p className="mt-3 text-ink-soft">
          Real humans, one-business-day replies. Pick a topic — or just email us.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {TOPICS.map(({ icon: Icon, title, body, href, link }) => (
          <div key={title} className="card p-6">
            <Icon size={20} className="text-clay-600" aria-hidden />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            <Link href={href as never} className="mt-3 inline-block text-sm font-semibold text-clay-700 hover:underline">
              {link}
            </Link>
          </div>
        ))}
      </div>

      <div className="card mt-10 flex flex-col items-start gap-4 bg-ink p-8 text-paper sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Mail size={22} className="mt-0.5 text-clay-300" aria-hidden />
          <div>
            <h2 className="font-display text-xl font-semibold">Write to the studio</h2>
            <p className="mt-1 text-sm text-paper/70">
              Include your order number for the fastest resolution.
            </p>
          </div>
        </div>
        <a href={`mailto:${site.supportEmail}`} className="btn bg-paper text-ink hover:bg-clay-100">
          {site.supportEmail}
        </a>
      </div>
    </div>
  )
}
