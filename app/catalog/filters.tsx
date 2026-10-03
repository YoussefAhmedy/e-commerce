'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Facets {
  colors: string[]
  materials: string[]
  sizes: string[]
  priceRange: { minCents: number; maxCents: number }
}

const SORTS = [
  { value: 'relevance', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low → high' },
  { value: 'price-desc', label: 'Price: high → low' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'popular', label: 'Most reviewed' },
] as const

/** Filter sidebar — every change re-navigates; the server re-queries. */
export function CatalogFilters({
  categories,
  facets,
  current,
  resultCount,
}: {
  categories: Array<{ slug: string; name: string }>
  facets: Facets
  current: Record<string, string | string[] | undefined>
  resultCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const get = (k: string) => (typeof current[k] === 'string' ? (current[k] as string) : '')

  const [min, setMin] = useState(get('min'))
  const [max, setMax] = useState(get('max'))
  // Sync from server state during render (official pattern — no post-render effect).
  const currentKey = JSON.stringify(current)
  const [prevKey, setPrevKey] = useState(currentKey)
  if (prevKey !== currentKey) {
    setPrevKey(currentKey)
    setMin(get('min'))
    setMax(get('max'))
  }

  const navigate = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(current)) {
        if (typeof v === 'string') params.set(k, v)
      }
      params.delete('page')
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
      const qs = params.toString()
      router.push(`/catalog${qs ? `?${qs}` : ''}` as never)
    },
    [current, router],
  )

  const panel = (
    <div className="space-y-7">
      <div>
        <h3 className="label">Sort</h3>
        <select
          className="field"
          value={get('sort') || 'relevance'}
          onChange={(e) => navigate({ sort: e.target.value === 'relevance' ? '' : e.target.value })}
          aria-label="Sort products"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="label">Category</h3>
        <ul className="space-y-1">
          <li>
            <button
              className={cn('w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors', !get('category') ? 'bg-cream font-semibold text-ink' : 'text-ink-soft hover:bg-cream/60')}
              onClick={() => navigate({ category: '' })}
            >
              All categories
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <button
                className={cn('w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors', get('category') === c.slug ? 'bg-cream font-semibold text-ink' : 'text-ink-soft hover:bg-cream/60')}
                onClick={() => navigate({ category: get('category') === c.slug ? '' : c.slug })}
                aria-pressed={get('category') === c.slug}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="label">Type</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Product type">
          {[
            { v: 'POSTER', l: 'Prints' },
            { v: 'FRAME', l: 'Frames' },
          ].map((t) => (
            <button
              key={t.v}
              onClick={() => navigate({ type: get('type') === t.v ? '' : t.v })}
              aria-pressed={get('type') === t.v}
              className={cn('chip transition-colors', get('type') === t.v && '!border-clay-600 !bg-clay-600 !text-white')}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ min, max })
        }}
      >
        <h3 className="label">Price ($)</h3>
        <div className="flex items-center gap-2">
          <input className="field !py-2" inputMode="numeric" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Minimum price" />
          <span className="text-ink-faint">–</span>
          <input className="field !py-2" inputMode="numeric" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Maximum price" />
          <button type="submit" className="btn-secondary !px-3 !py-2 text-xs">Go</button>
        </div>
      </form>

      {facets.materials.length > 0 && (
        <div>
          <h3 className="label">Material</h3>
          <div className="flex flex-wrap gap-2">
            {facets.materials.map((m) => (
              <button
                key={m}
                onClick={() => navigate({ material: get('material') === m ? '' : m })}
                aria-pressed={get('material') === m}
                className={cn('chip capitalize transition-colors', get('material') === m && '!border-clay-600 !bg-clay-600 !text-white')}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.colors.length > 0 && (
        <div>
          <h3 className="label">Color</h3>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => (
              <button
                key={c}
                onClick={() => navigate({ color: get('color') === c ? '' : c })}
                aria-pressed={get('color') === c}
                className={cn('chip capitalize transition-colors', get('color') === c && '!border-clay-600 !bg-clay-600 !text-white')}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="label">Availability</h3>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-clay-600"
            checked={get('stock') === '1'}
            onChange={(e) => navigate({ stock: e.target.checked ? '1' : '' })}
          />
          In stock only
        </label>
      </div>
    </div>
  )

  return (
    <aside aria-label="Filters">
      <button className="btn-secondary mb-4 w-full lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={16} aria-hidden /> Filters & sort
      </button>

      {/* Desktop */}
      <div className="sticky top-28 hidden lg:block">{panel}</div>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-paper p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Filters</h2>
              <button onClick={() => setOpen(false)} aria-label="Close filters" className="rounded-full p-2 hover:bg-cream">
                <X size={20} aria-hidden />
              </button>
            </div>
            {panel}
            <button className="btn-primary mt-8 w-full" onClick={() => setOpen(false)}>
              Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
