import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Package } from 'lucide-react'
import { productDetail } from '@/lib/services/catalog'
import { listProductReviews } from '@/lib/db/repositories/engagement'
import { similarProducts } from '@/lib/services/recommendations'
import { ProductCard } from '@/components/storefront/product-card'
import { Gallery } from './gallery'
import { PurchasePanel } from './purchase-panel'
import { ReviewsSection } from './reviews'
import { TrackView } from './track-view'
import { site } from '@/lib/config/site'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const product = productDetail(slug)
  if (!product) return { title: 'Not found' }
  const title = product.seoTitle ?? product.name
  const description = product.seoDescription ?? product.summary ?? product.description.slice(0, 155)
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      images: product.images[0] ? [{ url: product.images[0].url, alt: product.name }] : undefined,
      type: 'website',
    },
  }
}

export default async function ProductPage({ params }: Ctx) {
  const { slug } = await params
  const product = productDetail(slug)
  if (!product) notFound()

  const reviews = listProductReviews(product.id)
  const related = similarProducts(product, 4)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary || product.description,
    image: product.images.map((i) => i.url),
    brand: { '@type': 'Brand', name: site.name },
    ...(product.ratingAvg
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount } }
      : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: (product.basePriceCents / 100).toFixed(2),
      availability: product.variants.some((v) => v.stock - v.reserved > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${site.url}/products/${product.slug}`,
    },
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <TrackView productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-faint">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={'/' as never} className="hover:text-ink">Home</Link> <span aria-hidden>/</span></li>
          <li><Link href={'/catalog' as never} className="hover:text-ink">Catalog</Link> <span aria-hidden>/</span></li>
          {product.categorySlug && (
            <li>
              <Link href={`/catalog?category=${product.categorySlug}` as never} className="hover:text-ink">{product.categoryName}</Link>
              <span aria-hidden> /</span>
            </li>
          )}
          <li aria-current="page" className="text-ink-soft">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <Gallery images={product.images} name={product.name} />
        <PurchasePanel product={product} />
      </div>

      <section aria-label="Details" className="mt-14 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">About this piece</h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft">{product.description}</p>
          {product.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <a key={t} href={`/catalog?q=${encodeURIComponent(t)}`} className="chip hover:border-clay-300 hover:text-clay-700">
                  #{t}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="card h-fit p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-soft">Specifications</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {Object.entries(product.attributes).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="capitalize text-ink-faint">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">Print quality</dt>
              <dd className="font-medium">12-color giclée · archival</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-faint">Fulfillment</dt>
              <dd className="text-right font-medium">
                <span className="inline-flex items-center gap-1"><Package size={14} aria-hidden /> Made to order · 2–4 days</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <ReviewsSection
        productId={product.id}
        productSlug={product.slug}
        initialReviews={reviews}
        ratingAvg={product.ratingAvg}
        ratingCount={product.ratingCount}
      />

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-20">
          <h2 id="related" className="mb-8 font-display text-2xl font-semibold tracking-tight">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
