import type { Metadata } from 'next'
import { PackageSearch } from 'lucide-react'
import { browse, facets } from '@/lib/services/catalog'
import { listCategories } from '@/lib/db/repositories/products'
import { ProductCard } from '@/components/storefront/product-card'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { CatalogFilters } from './filters'

export const metadata: Metadata = {
  title: 'Shop the collection',
  description: 'Browse art prints and hand-cut frames. Filter by color, material, size and price.',
  alternates: { canonical: '/catalog' },
}

export const dynamic = 'force-dynamic'

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const result = browse(sp)
  const f = facets()
  const categories = listCategories()

  const makeHref = (page: number) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string' && k !== 'page') params.set(k, v)
    }
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return `/catalog${qs ? `?${qs}` : ''}`
  }

  const activeQuery = typeof sp.q === 'string' ? sp.q : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {activeQuery ? <>Results for <span className="text-clay-600">“{activeQuery}”</span></> : 'The collection'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {result.total} {result.total === 1 ? 'piece' : 'pieces'}
          {result.products.length > 0 && ` · page ${result.page} of ${result.totalPages}`}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <CatalogFilters
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          facets={f}
          current={sp}
          resultCount={result.total}
        />

        <div>
          {result.products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Nothing matches those filters"
              body="Try widening the price range, clearing a filter, or searching for something broader like “landscape” or “oak”."
              action={{ href: '/catalog', label: 'Clear all filters' }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                {result.products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 3} />
                ))}
              </div>
              <Pagination page={result.page} totalPages={result.totalPages} makeHref={makeHref} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
