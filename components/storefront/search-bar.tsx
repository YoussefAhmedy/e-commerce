'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'

interface Suggestion {
  slug: string
  name: string
  type: 'POSTER' | 'FRAME'
  priceCents: number
  imageUrl: string | null
}

/**
 * Typeahead search — debounced (250ms), keyboard navigable,
 * hits the dedicated suggest endpoint (no full-catalog scans per keystroke).
 */
export function SearchBar({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlight, setHighlight] = useState(-1)
  const router = useRouter()
  const boxRef = useRef<HTMLDivElement>(null)

  const trimmed = q.trim()
  // Reset below-minimum state during render (official "adjust on props" pattern).
  const [prevTrimmed, setPrevTrimmed] = useState(trimmed)
  if (prevTrimmed !== trimmed) {
    setPrevTrimmed(trimmed)
    if (trimmed.length < 2) {
      setSuggestions([])
      setOpen(false)
      setHighlight(-1)
    }
  }

  useEffect(() => {
    if (trimmed.length < 2) return
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(trimmed)}`)
        const json = await res.json()
        setSuggestions(json?.data?.suggestions ?? [])
        setOpen(true)
        setHighlight(-1)
      } catch {
        setSuggestions([])
      } finally {
        setBusy(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [trimmed])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function go(href: string) {
    setOpen(false)
    onNavigate?.()
    router.push(href as never)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        go(`/catalog?q=${encodeURIComponent(q)}`)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = highlight >= 0 ? suggestions[highlight] : undefined
      go(s ? `/products/${s.slug}` : `/catalog?q=${encodeURIComponent(q)}`)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 transition-colors focus-within:border-clay-400">
        {busy ? <Loader2 size={17} className="animate-spin text-ink-faint" aria-hidden /> : <Search size={17} className="text-ink-faint" aria-hidden />}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoFocus={autoFocus}
          placeholder='Try "oak frame" or "abstract print"…'
          aria-label="Search products"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        <span className="hidden rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft sm:block">⏎</span>
      </div>

      {open && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-lift"
        >
          {suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-soft">No matches — press Enter for full search.</li>
          )}
          {suggestions.map((s, i) => (
            <li key={s.slug} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === highlight ? 'bg-cream' : 'hover:bg-cream/60'}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(`/products/${s.slug}`)}
              >
                <span className="relative h-10 w-8 shrink-0 overflow-hidden rounded-md bg-cream">
                  {s.imageUrl && <Image src={s.imageUrl} alt="" fill sizes="32px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                  <span className="text-xs text-ink-faint">{s.type === 'FRAME' ? 'Frame' : 'Print'}</span>
                </span>
                <span className="text-sm font-medium text-ink">{formatMoney(s.priceCents, 'USD')}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-clay-700 hover:bg-clay-50"
              onClick={() => go(`/catalog?q=${encodeURIComponent(q)}`)}
            >
              See all results for “{q}”
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
