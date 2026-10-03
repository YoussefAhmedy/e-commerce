'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

interface AssistantProduct {
  slug: string
  name: string
  priceCents: number
  currency: string
  imageUrl: string | null
  inStock: boolean
}

const STARTERS = [
  'Show me botanical prints under $30',
  'I need a natural oak frame',
  'Something abstract for a large wall',
  'What gold frames do you have?',
]

/**
 * AI assistant — grounded: product facts come from server-side catalog
 * tools, never from the model's imagination. Labeled honestly: when no LLM
 * key is configured it runs in deterministic "basic mode".
 */
export function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [products, setProducts] = useState<AssistantProduct[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [grounded, setGrounded] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function send(text: string) {
    if (!text.trim() || busy) return
    const nextMsgs: Msg[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages(nextMsgs)
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), thread: nextMsgs.slice(-10) }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'The assistant is unavailable right now.')
        return
      }
      setMessages([...nextMsgs, { role: 'assistant', content: json.data.text }])
      setProducts(json.data.products ?? [])
      setGrounded(json.data.grounded)
    } catch {
      setError('Network hiccup — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col px-4 py-10 sm:px-6">
      <header className="text-center">
        <p className="chip mx-auto w-fit">
          <Sparkles size={12} aria-hidden /> Catalog assistant
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Describe what you're looking for
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Ask in plain language — “oak frame under $80”. I search the live catalog
          and only quote real products and prices.
        </p>
        {!grounded && messages.length > 0 && (
          <p className="mt-2 text-xs text-ink-faint">Basic mode (no AI key configured) — deterministic catalog search.</p>
        )}
      </header>

      <div className="card mt-8 flex min-h-[22rem] flex-1 flex-col p-4 sm:p-5">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="grid gap-2 pt-6 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm text-ink-soft transition-all hover:border-clay-300 hover:bg-clay-50 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  m.role === 'user' ? 'bg-ink text-paper' : 'bg-cream text-ink',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-cream px-4 py-3">
                <Loader2 size={16} className="animate-spin text-ink-soft" aria-label="Assistant is thinking" />
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
          <div ref={bottom} />
        </div>

        <form
          className="mt-3 flex items-center gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <input
            className="field !rounded-full"
            value={input}
            maxLength={600}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about prints, frames, sizes, colors, prices…"
            aria-label="Message the assistant"
          />
          <button type="submit" className="btn-accent !p-3" disabled={busy || !input.trim()} aria-label="Send message">
            <Send size={16} aria-hidden />
          </button>
        </form>
      </div>

      {/* Grounded product results */}
      {products.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Matching products">
          {products.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}` as never}
              className="card flex items-center gap-4 p-3 transition-shadow hover:shadow-lift"
            >
              <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-cream">
                {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-ink-faint">{p.inStock ? 'In stock' : 'Sold out'}</span>
              </span>
              <span className="text-sm font-semibold">{formatMoney(p.priceCents, p.currency)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
