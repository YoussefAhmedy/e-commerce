'use client'

/* eslint-disable @next/next/no-img-element -- frame preview uses same-origin upload URLs */
import { Ruler } from 'lucide-react'

/**
 * Live preview of the customer's upload, matted in the chosen frame style.
 * Pure CSS — frame drawn as a padded beveled box around the image.
 */
export function FramePreview({
  imageUrl,
  frame,
}: {
  imageUrl: string
  frame: { color: string; material: string } | null
}) {
  const frameColor: Record<string, string> = {
    black: '#151313',
    white: '#f7f5f2',
    natural: '#c8a273',
    oak: '#b98d5f',
    walnut: '#5d4634',
    gold: '#c9a24b',
    silver: '#b9bdc2',
    brass: '#b08d57',
  }
  const border = frame ? (frameColor[frame.color] ?? '#8a6a48') : 'transparent'

  return (
    <div className="relative mx-auto w-full max-w-sm" aria-label="Preview of your custom print">
      {/* Wall shadow */}
      <div aria-hidden className="absolute inset-x-6 -bottom-6 h-8 rounded-[50%] bg-ink/15 blur-md" />
      <div
        className="relative overflow-hidden rounded-md shadow-lift transition-all duration-300"
        style={{
          border: `1px solid ${frame ? 'rgba(0,0,0,0.25)' : 'var(--color-line)'}`,
        }}
      >
        <div
          className="transition-all duration-300"
          style={{
            padding: frame ? '22px' : '0px',
            background: border,
            boxShadow: frame ? 'inset 0 2px 6px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.3)' : undefined,
          }}
        >
          <div
            className="transition-all duration-300"
            style={{ padding: frame ? '14px' : '0px', background: '#fdfcfa' }}
          >
            {/* Uploaded images are same-origin /api/media — plain img avoids optimizer round-trips for blobs */}
            <img src={imageUrl} alt="Preview of your uploaded artwork" className="block h-auto w-full" />
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
        <Ruler size={12} aria-hidden />
        {frame ? `Framed · ${frame.material} · ${frame.color}` : 'Print only'}
      </p>
    </div>
  )
}
