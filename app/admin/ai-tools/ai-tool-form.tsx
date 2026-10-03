'use client'

import { useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { aiGenerate } from '@/app/admin/actions'

type Kind = 'description' | 'seo' | 'tags'

const KIND_LABELS: Record<Kind, string> = {
  description: 'Product description',
  seo: 'SEO title + meta description',
  tags: 'Search tags',
}

export function AiToolForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<Kind>('description')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('')
  const [material, setMaterial] = useState('')
  const [keywords, setKeywords] = useState('')
  const [result, setResult] = useState<{ text: string; note: string; grounded: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function generate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCopied(false)
    startTransition(async () => {
      const res = await aiGenerate({
        kind,
        name,
        category: categories.find((c) => c.id === categoryId)?.name ?? '',
        attributes: { ...(color ? { color } : {}), ...(material ? { material } : {}) },
        keywords,
      })
      if (!res.ok) { setError(res.error); setResult(null) }
      else setResult({ ...res.data, text: res.data.text.replaceAll('\\n', '\n') })
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={generate} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="ai-kind">What to draft</label>
          <select id="ai-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ai-name">Product name</label>
          <input id="ai-name" className="input" required minLength={2} maxLength={140} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Golden Hour Dunes" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ai-cat">Category</label>
            <select id="ai-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ai-keywords">Keywords / hints</label>
            <input id="ai-keywords" className="input" maxLength={200} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="desert, warm, calm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ai-color">Color</label>
            <input id="ai-color" className="input" maxLength={40} value={color} onChange={(e) => setColor(e.target.value)} placeholder="terracotta" />
          </div>
          <div>
            <label className="label" htmlFor="ai-material">Material</label>
            <input id="ai-material" className="input" maxLength={40} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="archival matte paper" />
          </div>
        </div>
        <button type="submit" disabled={pending} className="btn-primary gap-1.5">
          <Sparkles size={15} aria-hidden />
          {pending ? 'Drafting…' : 'Generate draft'}
        </button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="card flex flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{KIND_LABELS[kind]}</h2>
          {result && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${result.grounded ? 'border-clay-200 bg-clay-50 text-clay-700' : 'border-line bg-cream text-ink-soft'}`}>
              {result.grounded ? 'AI draft' : 'template mode'}
            </span>
          )}
        </div>
        {result ? (
          <>
            <textarea
              className="input mt-4 min-h-64 flex-1 font-normal leading-relaxed"
              value={result.text}
              aria-label="Generated draft — edit before publishing"
              onChange={(e) => setResult({ ...result, text: e.target.value })}
            />
            <p className="mt-2 text-xs text-ink-faint">{result.note} Fact-check against the real product data before it goes live.</p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.text)
                  setCopied(true)
                }}
              >
                Copy to clipboard
              </button>
              {copied && <span className="text-xs text-forest-600">Copied — paste into the product editor</span>}
            </div>
          </>
        ) : (
          <p className="mt-8 text-center text-sm text-ink-faint">Your draft appears here, ready to edit.</p>
        )}
      </div>
    </div>
  )
}
