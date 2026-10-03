import { searchParamsToCatalogQuery } from '@/lib/search/params'
import { queryCatalog, getProductBySlug, catalogFacets, searchSuggest, listCategories, type CatalogResult, type CatalogQuery } from '@/lib/db/repositories/products'
import { trackEvent } from '@/lib/db/repositories/engagement'
import type { Product } from '@/lib/db/types'

/** Catalog-facing service: listing, detail, suggestions, facets. */

export function browse(params: URLSearchParams | Record<string, string | string[] | undefined>): CatalogResult {
  const query = searchParamsToCatalogQuery(params)
  const result = queryCatalog(query)
  if (query.q) trackEvent('SEARCH', { meta: { q: query.q.slice(0, 80) } })
  return result
}

export function facets() {
  return catalogFacets()
}

export function productDetail(slug: string): Product | null {
  const product = getProductBySlug(slug)
  if (!product || product.status !== 'PUBLISHED') return null
  return product
}

export function trackProductView(productId: string, userId?: string, sessionId?: string): void {
  trackEvent('PRODUCT_VIEW', { productId, userId, sessionId })
}

export function suggest(q: string) {
  if (q.trim().length < 2) return []
  return searchSuggest(q.trim())
}

export function categories() {
  return listCategories()
}

export type { CatalogQuery, CatalogResult }
