'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProductImage } from '@/lib/db/types'
import { cn } from '@/lib/utils/cn'

/** Image gallery with thumbnails + click-to-zoom (keyboard accessible). */
export function Gallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const active = images[index]

  if (images.length === 0) {
    return <div className="flex aspect-[4/5] items-center justify-center rounded-3xl bg-cream text-ink-faint">No image available</div>
  }

  return (
    <div>
      <div
        className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-3xl bg-cream"
        onClick={() => setZoom(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setZoom(true)}
        aria-label={`${name} — open image zoom`}
      >
        {active && (
          <Image
            src={active.url}
            alt={active.alt || name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 52vw"
            className="object-cover"
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Image ${i + 1} of ${images.length}`}
              onClick={() => setIndex(i)}
              className={cn(
                'relative h-20 w-16 overflow-hidden rounded-xl bg-cream transition-all',
                i === index ? 'ring-2 ring-clay-600 ring-offset-2 ring-offset-paper' : 'opacity-70 hover:opacity-100',
              )}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} — zoomed view`}
          onClick={() => setZoom(false)}
        >
          <button className="absolute right-5 top-5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20" autoFocus>
            Close (Esc)
          </button>
          <div className="relative h-full w-full" onKeyDown={(e) => e.key === 'Escape' && setZoom(false)} tabIndex={-1}>
            <Image src={active.url} alt={active.alt || name} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
