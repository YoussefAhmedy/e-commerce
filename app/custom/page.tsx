import type { Metadata } from 'next'
import { queryCatalog } from '@/lib/db/repositories/products'
import { Configurator } from './configurator'

export const metadata: Metadata = {
  title: 'Custom studio — your photo, gallery-framed',
  description: 'Upload a photo, pick a size, preview it in a hand-cut frame, and order museum-quality custom wall art.',
  alternates: { canonical: '/custom' },
}

export const dynamic = 'force-dynamic'

export default async function CustomStudioPage() {
  // The configurator needs: the "Custom Upload Print" product (its size
  // variants) and the frame catalog (variant-level pricing).
  const custom = queryCatalog({ q: undefined, pageSize: 48 })
  const customProduct = custom.products.find((p) => p.slug === 'custom-upload-print') ?? null
  const { products: frames } = queryCatalog({ type: 'FRAME', pageSize: 48 })

  return <Configurator customProduct={customProduct} frames={frames} />
}
