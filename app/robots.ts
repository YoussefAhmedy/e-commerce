import type { MetadataRoute } from 'next'
import { site } from '@/lib/config/site'

/** Private surfaces (account/orders/checkout/admin) must never be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/cart',
        '/checkout',
        '/order-confirmation',
        '/admin',
        '/api',
        '/signin',
        '/signup',
        '/wishlist',
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  }
}
