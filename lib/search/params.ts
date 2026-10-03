import type { CatalogQuery } from '@/lib/db/repositories/products'
import { commerce } from '@/lib/config/commerce'

/**
 * URL ↔ CatalogQuery mapping (single source for the storefront and /api).
 * Unknown/invalid values are dropped, never trusted.
 */

type Params = URLSearchParams | Record<string, string | string[] | undefined>

function get(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined
  const v = params[key]
  return Array.isArray(v) ? v[0] : v
}

const SORTS = ['relevance', 'newest', 'price-asc', 'price-desc', 'name', 'popular'] as const

export function searchParamsToCatalogQuery(params: Params): CatalogQuery {
  const sortRaw = get(params, 'sort')
  const pageRaw = Number(get(params, 'page') ?? '1')
  const minPrice = Number(get(params, 'min') ?? '')
  const maxPrice = Number(get(params, 'max') ?? '')
  const typeRaw = get(params, 'type')

  return {
    q: get(params, 'q')?.slice(0, 80),
    category: get(params, 'category')?.slice(0, 60),
    type: typeRaw === 'POSTER' || typeRaw === 'FRAME' ? typeRaw : undefined,
    color: get(params, 'color')?.slice(0, 40),
    material: get(params, 'material')?.slice(0, 40),
    size: get(params, 'size')?.slice(0, 40),
    inStockOnly: get(params, 'stock') === '1',
    featuredOnly: get(params, 'featured') === '1',
    minPriceCents: Number.isFinite(minPrice) && minPrice > 0 ? Math.round(minPrice * 100) : undefined,
    maxPriceCents: Number.isFinite(maxPrice) && maxPrice > 0 ? Math.round(maxPrice * 100) : undefined,
    sort: (SORTS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as CatalogQuery['sort']) : 'relevance',
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(Math.round(pageRaw), 500) : 1,
    pageSize: commerce.catalogPageSize,
  }
}
