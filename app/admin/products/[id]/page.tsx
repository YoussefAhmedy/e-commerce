import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getProductById, listCategories } from '@/lib/db/repositories/products'
import { ProductForm } from '../product-form'

export const metadata: Metadata = { title: 'Edit product' }
export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = getProductById(id)
  if (!product) notFound()
  const categories = listCategories()

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{product.name}</h1>
        {product.status === 'PUBLISHED' && (
          <Link href={`/products/${product.slug}` as never} className="inline-flex items-center gap-1 text-sm font-medium text-clay-700 hover:underline">
            View storefront <ExternalLink size={13} aria-hidden />
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">{product.status.toLowerCase()} · /{product.slug}</p>
      <ProductForm
        productId={product.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          slug: product.slug,
          name: product.name,
          summary: product.summary ?? '',
          description: product.description ?? '',
          categoryId: product.categoryId,
          type: product.type,
          status: product.status,
          basePriceCents: product.basePriceCents,
          compareAtCents: product.compareAtCents,
          tags: product.tags,
          attributes: product.attributes,
          featured: product.featured,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          images: product.images.map((i) => ({ url: i.url, alt: i.alt, position: i.position })),
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            options: v.options,
            priceDeltaCents: v.priceDeltaCents,
            stock: v.stock,
            active: v.active,
          })),
        }}
      />
    </div>
  )
}
