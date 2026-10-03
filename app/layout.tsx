import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { site } from '@/lib/config/site'
import { SiteHeader } from '@/components/storefront/header'
import { SiteFooter } from '@/components/storefront/footer'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    siteName: site.name,
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#faf8f5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {/* Header reads the session/cart — dynamic per request. */}
        <Suspense fallback={<div className="h-[104px] border-b border-line bg-paper" aria-hidden />}>
          <SiteHeader />
        </Suspense>
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
