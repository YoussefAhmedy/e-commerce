'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { saveProduct, aiGenerate } from '@/app/admin/actions'

interface VariantDraft {
  id?: string
  sku: string
  name: string
  options: Record<string, string>
  priceDeltaCents: number
  stock: number
  active: boolean
}
interface ImageDraft { url: string; alt: string; position: number }

export interface ProductInitial {
  slug: string
  name: string
  summary: string
  description: string
  categoryId: string | null
  type: 'POSTER' | 'FRAME'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  basePriceCents: number
  compareAtCents: number | null
  tags: string[]
  attributes: Record<string, string>
  featured: boolean
  seoTitle: string | null
  seoDescription: string | null
  images: ImageDraft[]
  variants: VariantDraft[]
}

const EMPTY_VARIANT: VariantDraft = { sku: '', name: 'Standard', options: {}, priceDeltaCents: 0, stock: 25, active: true }

function dollars(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toFixed(2)
}
function cents(value: string): number | null {
  const n = Math.round(parseFloat(value || '0') * 100)
  return Number.isFinite(n) && n >= 0 ? n : null
}
function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function ProductForm({
  productId,
  initial,
  categories,
}: {
  productId?: string
  initial?: ProductInitial
  categories: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '')
  const [type, setType] = useState<'POSTER' | 'FRAME'>(initial?.type ?? 'POSTER')
  const [status, setStatus] = useState(initial?.status ?? 'DRAFT')
  const [featured, setFeatured] = useState(initial?.featured ?? false)
  const [basePrice, setBasePrice] = useState(dollars(initial?.basePriceCents ?? null))
  const [compareAt, setCompareAt] = useState(dollars(initial?.compareAtCents ?? null))
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '))
  const [attrs, setAttrs] = useState<Array<[string, string]>>(Object.entries(initial?.attributes ?? {}))
  const [images, setImages] = useState<ImageDraft[]>(initial?.images ?? [])
  const [variants, setVariants] = useState<VariantDraft[]>(initial?.variants ?? [{ ...EMPTY_VARIANT }])
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '')
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [aiPending, setAiPending] = useState(false)

  const fe = (k: string) => fieldErrors[k]?.[0]

  function aiDraftDescription() {
    setAiPending(true)
    setAiNote(null)
    void (async () => {
      const categoryName = categories.find((c) => c.id === categoryId)?.name ?? ''
      const res = await aiGenerate({
        kind: 'description',
        name: name || 'Untitled piece',
        category: categoryName,
        attributes: Object.fromEntries(attrs.filter(([k]) => k.trim())),
        keywords: tagsInput,
      })
      setAiPending(false)
      if (res.ok) {
        setDescription(res.data.text.replaceAll('\\n', '\n'))
        setAiNote(res.data.note + (res.data.grounded ? '' : ' (template mode — no AI key configured)'))
      } else setAiNote(res.error)
    })()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const base = cents(basePrice)
    const payload = {
      slug: slug || slugify(name),
      name,
      summary,
      description,
      categoryId: categoryId || null,
      type,
      status,
      basePriceCents: base ?? -1,
      compareAtCents: compareAt ? cents(compareAt) : null,
      tags: tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      attributes: Object.fromEntries(attrs.filter(([k]) => k.trim())),
      featured,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      images: images.map((img, i) => ({ ...img, position: i })).filter((img) => img.url.trim()),
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        options: v.options,
        priceDeltaCents: Math.max(0, v.priceDeltaCents),
        stock: Math.max(0, Math.floor(v.stock)),
        active: v.active,
      })),
    }
    startTransition(async () => {
      const res = await saveProduct(payload, productId)
      if (!res.ok) {
        setError(res.error)
        setFieldErrors(res.fields ?? {})
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      router.push('/admin/products' as never)
      router.refresh()
    })
  }

  const setVariant = (i: number, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  const setImage = (i: number, patch: Partial<ImageDraft>) =>
    setImages((is) => is.map((img, j) => (j === i ? { ...img, ...patch } : img)))

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 lg:col-span-2">
          {error} {fe('slug') && `Slug: ${fe('slug')}`}
        </div>
      )}

      <div className="space-y-6">
        {/* Basics */}
        <section className="card space-y-4 p-5" aria-labelledby="basics-h">
          <h2 id="basics-h" className="font-display text-lg font-semibold">Basics</h2>
          <div>
            <label className="label" htmlFor="p-name">Name</label>
            <input id="p-name" className="input" value={name} required maxLength={140}
              onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
          </div>
          <div>
            <label className="label" htmlFor="p-slug">Slug</label>
            <input id="p-slug" className="input font-mono text-sm" value={slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*"
              aria-invalid={Boolean(fe('slug'))} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }} />
            {fe('slug') && <p className="mt-1 text-xs text-red-600">{fe('slug')}</p>}
          </div>
          <div>
            <label className="label" htmlFor="p-summary">Summary <span className="font-normal text-ink-faint">(cards & previews)</span></label>
            <input id="p-summary" className="input" value={summary} maxLength={240} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="p-desc">Description</label>
              <button type="button" onClick={aiDraftDescription} disabled={aiPending} className="btn-ghost !px-2.5 !py-1 text-xs text-clay-700">
                <Sparkles size={13} aria-hidden className="mr-1 inline" />
                {aiPending ? 'Drafting…' : 'AI draft'}
              </button>
            </div>
            {aiNote && <p className="mb-1.5 text-xs text-ink-faint">{aiNote}</p>}
            <textarea id="p-desc" className="input min-h-40" value={description} maxLength={8000} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </section>

        {/* Images */}
        <section className="card space-y-4 p-5" aria-labelledby="images-h">
          <div className="flex items-center justify-between">
            <h2 id="images-h" className="font-display text-lg font-semibold">Images</h2>
            <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setImages((i) => [...i, { url: '', alt: '', position: i.length }])}>
              <Plus size={13} aria-hidden className="mr-1 inline" /> Add image
            </button>
          </div>
          {images.length === 0 && <p className="text-sm text-ink-faint">No images yet — shoppers see a placeholder.</p>}
          {images.map((img, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                {/* live preview; plain img avoids next/image domain config for arbitrary admin URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.url && <img src={img.url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_200px]">
                <input className="input" placeholder="Image URL" value={img.url} aria-label={`Image ${i + 1} URL`}
                  onChange={(e) => setImage(i, { url: e.target.value })} />
                <input className="input" placeholder="Alt text (accessibility)" value={img.alt} aria-label={`Image ${i + 1} alt text`}
                  onChange={(e) => setImage(i, { alt: e.target.value })} />
              </div>
              <button type="button" className="btn-ghost !px-2 !py-2 text-ink-faint hover:text-red-600" aria-label={`Remove image ${i + 1}`}
                onClick={() => setImages((is) => is.filter((_, j) => j !== i))}>
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
        </section>

        {/* Variants */}
        <section className="card space-y-4 p-5" aria-labelledby="variants-h">
          <div className="flex items-center justify-between">
            <h2 id="variants-h" className="font-display text-lg font-semibold">Variants <span className="text-sm font-normal text-ink-faint">(at least one)</span></h2>
            <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setVariants((v) => [...v, { ...EMPTY_VARIANT }])}>
              <Plus size={13} aria-hidden className="mr-1 inline" /> Add variant
            </button>
          </div>
          {fe('variants') && <p className="text-sm text-red-600">{fe('variants')}</p>}
          {variants.map((v, i) => (
            <div key={i} className="grid gap-2.5 rounded-xl border border-line p-3.5 sm:grid-cols-[130px_1fr_120px_110px_90px_auto] sm:items-center">
              <input className="input" placeholder="SKU" value={v.sku} aria-label={`Variant ${i + 1} SKU`}
                onChange={(e) => setVariant(i, { sku: e.target.value })} required />
              <div className="flex gap-2">
                <input className="input" placeholder="Name (e.g. A2 · 40×50)" value={v.name} aria-label={`Variant ${i + 1} name`}
                  onChange={(e) => setVariant(i, { name: e.target.value })} required />
                <input className="input w-28" placeholder="Size" value={v.options.size ?? ''} aria-label={`Variant ${i + 1} size option`}
                  onChange={(e) => setVariant(i, { options: { ...v.options, ...(e.target.value ? { size: e.target.value } : {}) } })} />
              </div>
              <input className="input" type="number" min={0} step="0.01" placeholder="+$ (delta)" value={v.priceDeltaCents ? (v.priceDeltaCents / 100).toFixed(2) : ''}
                aria-label={`Variant ${i + 1} price delta in dollars`}
                onChange={(e) => setVariant(i, { priceDeltaCents: Math.round(parseFloat(e.target.value || '0') * 100) || 0 })} />
              <input className="input" type="number" min={0} step="1" placeholder="Stock" value={v.stock} aria-label={`Variant ${i + 1} stock`}
                onChange={(e) => setVariant(i, { stock: parseInt(e.target.value, 10) || 0 })} />
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input type="checkbox" checked={v.active} onChange={(e) => setVariant(i, { active: e.target.checked })} className="accent-clay-600" />
                Active
              </label>
              <button type="button" className="btn-ghost !px-2 !py-2 text-ink-faint hover:text-red-600" aria-label={`Remove variant ${i + 1}`}
                disabled={variants.length === 1} onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}>
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
          <p className="text-xs text-ink-faint">Price delta adds to the base price — stock edits here do not rewrite reservation & audit history.</p>
        </section>

        {/* Attributes */}
        <section className="card space-y-4 p-5" aria-labelledby="attrs-h">
          <div className="flex items-center justify-between">
            <h2 id="attrs-h" className="font-display text-lg font-semibold">Attributes <span className="text-sm font-normal text-ink-faint">(facet filters: color, material…)</span></h2>
            <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setAttrs((a) => [...a, ['', '']])}>
              <Plus size={13} aria-hidden className="mr-1 inline" /> Add
            </button>
          </div>
          {attrs.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
              <input className="input w-36" placeholder="color" value={k} aria-label={`Attribute ${i + 1} key`}
                onChange={(e) => setAttrs((a) => a.map((pair, j) => (j === i ? [e.target.value, pair[1]] : pair)))} />
              <input className="input flex-1" placeholder="sage" value={v} aria-label={`Attribute ${i + 1} value`}
                onChange={(e) => setAttrs((a) => a.map((pair, j) => (j === i ? [pair[0], e.target.value] : pair)))} />
              <button type="button" className="btn-ghost !px-2 !py-2 text-ink-faint hover:text-red-600" aria-label={`Remove attribute ${i + 1}`}
                onClick={() => setAttrs((a) => a.filter((_, j) => j !== i))}>
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
        </section>

        {/* SEO */}
        <section className="card space-y-4 p-5" aria-labelledby="seo-h">
          <h2 id="seo-h" className="font-display text-lg font-semibold">SEO</h2>
          <div>
            <label className="label" htmlFor="p-seo-title">Title <span className="font-normal text-ink-faint">({seoTitle.length}/160)</span></label>
            <input id="p-seo-title" className="input" value={seoTitle} maxLength={160} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-seo-desc">Meta description <span className="font-normal text-ink-faint">({seoDescription.length}/300)</span></label>
            <textarea id="p-seo-desc" className="input min-h-20" value={seoDescription} maxLength={300} onChange={(e) => setSeoDescription(e.target.value)} />
          </div>
        </section>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="p-status">Status</label>
            <select id="p-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-type">Type</label>
            <select id="p-type" className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="POSTER">Poster / art print</option>
              <option value="FRAME">Frame</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-cat">Category</label>
            <select id="p-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-clay-600" />
            Featured on the homepage
          </label>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="p-price">Base price (USD)</label>
            <input id="p-price" className="input" type="number" min={0} step="0.01" value={basePrice} required aria-invalid={Boolean(fe('basePriceCents'))}
              onChange={(e) => setBasePrice(e.target.value)} />
            {fe('basePriceCents') && <p className="mt-1 text-xs text-red-600">{fe('basePriceCents')}</p>}
          </div>
          <div>
            <label className="label" htmlFor="p-compare">Compare-at price <span className="font-normal text-ink-faint">(optional)</span></label>
            <input id="p-compare" className="input" type="number" min={0} step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-tags">Tags <span className="font-normal text-ink-faint">(comma separated)</span></label>
            <input id="p-tags" className="input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="botanical, minimal, green" />
          </div>
        </section>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
        </button>
      </div>
    </form>
  )
}
