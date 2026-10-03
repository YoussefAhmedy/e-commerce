import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { PackageSearch, Plus } from 'lucide-react'
import { queryCatalog } from '@/lib/db/repositories/products'
import { formatMoney } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'
import { RowActions } from './row-actions'

export const metadata: Metadata = { title: 'Products' }
export const dynamic = 'force-dynamic'

const STATUS_TONE = { DRAFT: 'neutral', PUBLISHED: 'good', ARCHIVED: 'warn' } as const

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const type = sp.type === 'FRAME' || sp.type === 'POSTER' ? (sp.type as 'FRAME' | 'POSTER') : undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const { products, totalPages, total } = queryCatalog({ q: q || undefined, type, includeUnpublished: true, sort: 'newest', page, pageSize: 24 })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-ink-soft">{total} listings — draft, published and archived</p>
        </div>
        <Link href={'/admin/products/new' as never} className="btn-primary gap-1.5">
          <Plus size={16} aria-hidden /> New product
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2" action="/admin/products">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, tags…"
          className="input min-w-56 flex-1"
          aria-label="Search products"
        />
        <select name="type" defaultValue={type ?? ''} className="input w-auto" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="POSTER">Posters</option>
          <option value="FRAME">Frames</option>
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No matching products"
          body="Try a different search, or create the first listing."
          action={{ href: '/admin/products/new', label: 'New product' }}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Stock</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const stock = p.variants.reduce((acc, v) => acc + (v.stock - v.reserved), 0)
                const low = stock <= 3 && stock > 0
                return (
                  <tr key={p.id} className="border-t border-line transition-colors hover:bg-cream/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${p.id}` as never} className="flex items-center gap-3 font-medium hover:text-clay-700">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cream">
                          {p.images[0] && (
                            <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" unoptimized={p.images[0].url.startsWith('data:')} />
                          )}
                        </span>
                        <span>
                          <span className="block">{p.name}</span>
                          <span className="block text-xs font-normal text-ink-faint">/{p.slug}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{p.type === 'FRAME' ? 'Frame' : 'Poster'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[p.status] as never}>{p.status.toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.basePriceCents, p.currency)}</td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', stock === 0 ? 'text-red-600' : low ? 'font-semibold text-amber-700' : '')}>
                      {stock}
                    </td>
                    <td className="px-4 py-3 text-right"><RowActions productId={p.id} status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/products?q=${encodeURIComponent(q)}&type=${type ?? ''}&page=${p}`} />
    </div>
  )
}
