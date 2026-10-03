'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, RefreshCw } from 'lucide-react'
import type { Product, ProductVariant } from '@/lib/db/types'
import { formatMoney } from '@/lib/utils/format'
import { emitCartChange } from '@/lib/utils/events'
import { cn } from '@/lib/utils/cn'
import { FramePreview } from './frame-preview'

type Step = 'upload' | 'size' | 'frame' | 'review'

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'size', label: 'Size' },
  { id: 'frame', label: 'Frame' },
  { id: 'review', label: 'Review' },
]

interface UploadedImage {
  uploadId: string
  url: string
  width: number | null
  height: number | null
}

/**
 * The custom-print configurator — the store's signature workflow.
 * Prices shown are derived from server-provided product data; the order
 * itself is re-priced server-side (as everywhere else).
 */
export function Configurator({
  customProduct,
  frames,
}: {
  customProduct: Product | null
  frames: Product[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [image, setImage] = useState<UploadedImage | null>(null)
  const [sizeId, setSizeId] = useState('')
  const [frameVariantId, setFrameVariantId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // These derivations are cheap (≤ 5 frames, ≤ 6 sizes) — plain compute beats
  // memoization plumbing and React-compiler edge cases.
  const sizes = customProduct?.variants ?? []
  const currency = customProduct?.currency ?? 'USD'

  const size = sizes.find((s) => s.id === sizeId) ?? sizes[0] ?? null
  const frameFrame = (() => {
    for (const f of frames) {
      const v = f.variants.find((x) => x.id === frameVariantId)
      if (v) return { product: f, variant: v }
    }
    return null
  })()

  const printPrice = customProduct && size ? customProduct.basePriceCents + size.priceDeltaCents : 0
  const framePrice = frameFrame ? frameFrame.product.basePriceCents + frameFrame.variant.priceDeltaCents : 0
  const total = printPrice + framePrice

  async function handleFile(file: File) {
    setError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Images must be under 8MB.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/v1/uploads', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Upload failed. Please try again.')
        return
      }
      setImage({ uploadId: json.data.uploadId, url: json.data.url, width: json.data.width, height: json.data.height })
      setStep('size')
    } catch {
      setError('Network hiccup — please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function addToCart() {
    if (!customProduct || !size || !image) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: size.id,
          quantity: 1,
          customization: {
            uploadId: image.uploadId,
            frameVariantId: frameVariantId ?? undefined,
            note: note.trim() || undefined,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not add your custom print to the cart.')
        return
      }
      emitCartChange()
      router.push('/cart')
    } finally {
      setBusy(false)
    }
  }

  if (!customProduct) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto text-amber-600" size={32} aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold">The custom studio is being set up</h1>
        <p className="mt-2 text-ink-soft">Run <code className="rounded bg-cream px-1.5 py-0.5">npm run db:seed</code> to enable it.</p>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-10 text-center">
        <p className="chip mx-auto mb-4 w-fit">Custom studio</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your photo, gallery-framed</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          Upload · size · frame. Every piece is printed on archival paper and framed to order.
        </p>
      </header>

      {/* Stepper */}
      <nav aria-label="Configuration steps" className="mb-10">
        <ol className="mx-auto flex max-w-xl items-center justify-between">
          {STEPS.map((s, i) => {
            const done = i < stepIndex
            const activeNow = i === stepIndex
            return (
              <li key={s.id} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      done ? 'bg-forest-600 text-white' : activeNow ? 'bg-ink text-paper' : 'bg-cream text-ink-faint',
                    )}
                    aria-hidden
                  >
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={cn('text-xs font-medium', activeNow ? 'text-ink' : 'text-ink-faint')} aria-current={activeNow ? 'step' : undefined}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <span className={cn('mx-2 mb-5 h-px flex-1', i < stepIndex ? 'bg-forest-600' : 'bg-line')} aria-hidden />}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="card p-6 sm:p-10">
        {/* ── Upload ─────────────────────────── */}
        {step === 'upload' && (
          <div>
            <h2 className="font-display text-2xl font-semibold">Upload your photo</h2>
            <p className="mt-1 text-sm text-ink-soft">JPEG, PNG or WebP up to 8MB. Higher resolution prints better.</p>
            <div
              className={cn(
                'mt-6 flex min-h-[18rem] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-colors',
                drag ? 'border-clay-500 bg-clay-50' : 'border-line bg-cream/50 hover:border-ink-faint',
              )}
              onClick={() => fileInput.current?.click()}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                const file = e.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
              aria-label="Upload an image"
            >
              {uploading ? (
                <>
                  <Loader2 size={34} className="animate-spin text-clay-600" aria-hidden />
                  <p className="mt-3 text-sm font-medium text-ink-soft">Processing your image…</p>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-soft">
                    <ImagePlus size={24} className="text-clay-600" aria-hidden />
                  </div>
                  <p className="mt-4 text-sm font-semibold">Drop your image here, or click to browse</p>
                  <p className="mt-1 text-xs text-ink-faint">We re-encode and color-prep it for print automatically</p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
                aria-hidden
                tabIndex={-1}
              />
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          </div>
        )}

        {/* ── Size ───────────────────────────── */}
        {step === 'size' && image && (
          <StepLayout
            title="Pick a size"
            subtitle="All sizes are printed on 200gsm archival matte paper."
            onBack={() => setStep('upload')}
            preview={<FramePreview imageUrl={image.url} frame={null} />}
          >
            <div className="space-y-3">
              {sizes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSizeId(s.id)}
                  aria-pressed={size?.id === s.id}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all',
                    size?.id === s.id ? 'border-clay-600 bg-clay-50 ring-1 ring-clay-600' : 'border-line bg-white hover:border-ink-faint',
                  )}
                >
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-ink-faint">{s.options['dimensions'] ?? s.name}</p>
                  </div>
                  <p className="font-semibold">{formatMoney(customProduct.basePriceCents + s.priceDeltaCents, currency)}</p>
                </button>
              ))}
            </div>
            <button className="btn-primary mt-6 w-full" onClick={() => setStep('frame')}>
              Continue to framing <ArrowRight size={15} aria-hidden />
            </button>
          </StepLayout>
        )}

        {/* ── Frame ──────────────────────────── */}
        {step === 'frame' && image && (
          <StepLayout
            title="Choose a frame"
            subtitle="Optional, hand-cut to fit. Or order the print on its own."
            onBack={() => setStep('size')}
            preview={
              <FramePreview
                imageUrl={image.url}
                frame={
                  frameFrame
                    ? { color: frameFrame.product.attributes['color'] ?? 'natural', material: frameFrame.product.attributes['material'] ?? 'wood' }
                    : null
                }
              />
            }
          >
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setFrameVariantId(null)}
                aria-pressed={frameVariantId === null}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  frameVariantId === null ? 'border-clay-600 bg-clay-50 ring-1 ring-clay-600' : 'border-line bg-white hover:border-ink-faint',
                )}
              >
                <p className="font-semibold">No frame</p>
                <p className="text-xs text-ink-faint">Print only, rolled & protected</p>
              </button>
              {frames.map((f) => {
                const v = f.variants[0] as ProductVariant | undefined
                if (!v) return null
                const selected = frameVariantId === f.variants[0]?.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setFrameVariantId(f.variants[0]?.id ?? null)}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-all',
                      selected ? 'border-clay-600 bg-clay-50 ring-1 ring-clay-600' : 'border-line bg-white hover:border-ink-faint',
                    )}
                  >
                    <p className="text-sm font-semibold">{f.name}</p>
                    <p className="text-xs capitalize text-ink-faint">
                      {f.attributes['material']} · {f.attributes['color']}
                    </p>
                    <p className="mt-1 text-sm font-semibold">+{formatMoney(f.basePriceCents + v.priceDeltaCents, f.currency)}</p>
                  </button>
                )
              })}
            </div>
            <button className="btn-primary mt-6 w-full" onClick={() => setStep('review')}>
              Review your piece <ArrowRight size={15} aria-hidden />
            </button>
          </StepLayout>
        )}

        {/* ── Review ─────────────────────────── */}
        {step === 'review' && image && size && (
          <StepLayout
            title="Your custom piece"
            subtitle="Printed on archival paper, framed to order in our studio."
            onBack={() => setStep('frame')}
            preview={
              <FramePreview
                imageUrl={image.url}
                frame={
                  frameFrame
                    ? { color: frameFrame.product.attributes['color'] ?? 'natural', material: frameFrame.product.attributes['material'] ?? 'wood' }
                    : null
                }
              />
            }
          >
            <dl className="space-y-2.5 rounded-2xl bg-cream/70 p-5 text-sm">
              <div className="flex justify-between"><dt>Print · {size.name} ({size.options['dimensions']})</dt><dd className="font-medium">{formatMoney(printPrice, currency)}</dd></div>
              <div className="flex justify-between">
                <dt>{frameFrame ? `Frame · ${frameFrame.product.name}` : 'No frame'}</dt>
                <dd className="font-medium">{frameFrame ? formatMoney(framePrice, currency) : '—'}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2.5 text-base font-bold">
                <dt>Total</dt><dd>{formatMoney(total, currency)}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <label htmlFor="custom-note" className="label">Note for the studio (optional)</label>
              <textarea
                id="custom-note"
                className="field min-h-20"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Crop guidance, color adjustments, gift note…"
              />
            </div>

            <button className="btn-accent mt-5 w-full !py-3.5" onClick={addToCart} disabled={busy}>
              {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Check size={17} aria-hidden />}
              Add to cart — {formatMoney(total, currency)}
            </button>
            {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

            <button
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ink-faint hover:text-ink"
              onClick={() => {
                setImage(null)
                setStep('upload')
              }}
            >
              <RefreshCw size={12} aria-hidden /> Start over with a different photo
            </button>
          </StepLayout>
        )}
      </div>
    </div>
  )
}

function StepLayout({
  title,
  subtitle,
  onBack,
  preview,
  children,
}: {
  title: string
  subtitle: string
  onBack: () => void
  preview: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <button className="btn-ghost -ml-3 mb-4 text-sm" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden /> Back
      </button>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="mx-auto w-full max-w-sm lg:sticky lg:top-32">{preview}</div>
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
