import type { MetadataRoute } from 'next'
import { site } from '@/lib/config/site'
import { queryCatalog, listCategories } from '@/lib/db/repositories/products'

/** Public SEO sitemap — published products/categories only. */
export default function sitemap(): MetadataRoute.Sitemap {
  const { products } = queryCatalog({ pageSize: 48 })
  const categories = listCategories()

  return [
    { url: site.url, changeFrequency: 'daily', priority: 1 },
    { url: `${site.url}/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${site.url}/custom`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${site.url}/search`, changeFrequency: 'monthly', priority: 0.4 },
    ...categories.map((c) => ({
      url: `${site.url}/catalog?category=${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${site.url}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
