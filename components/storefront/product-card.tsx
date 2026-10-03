import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/lib/db/types'
import { Price } from '@/components/ui/price'
import { Stars } from '@/components/ui/stars'
import { Badge } from '@/components/ui/badge'
import { WishlistButton } from './wishlist-button'

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = product.images[0]
  const inStock = product.variants.some((v) => v.stock - v.reserved > 0)
  const minPrice = Math.min(product.basePriceCents)
  const multiVariant = product.variants.length > 1

  return (
    <article className="group relative">
      <Link
        href={`/products/${product.slug}` as never}
        className="block overflow-hidden rounded-2xl bg-cream"
        aria-label={product.name}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt || product.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-faint">No image</div>
          )}
          {!inStock && (
            <div className="absolute inset-x-0 bottom-3 mx-3 rounded-full bg-ink/85 py-1.5 text-center text-xs font-semibold text-paper">
              Sold out
            </div>
          )}
          {product.compareAtCents != null && product.compareAtCents > minPrice && (
            <div className="absolute left-3 top-3">
              <Badge tone="info">Sale</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="mt-3 space-y-1 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug text-ink">
            <Link href={`/products/${product.slug}` as never} className="after:absolute after:inset-0">
              {product.name}
            </Link>
          </h3>
          <WishlistButton productId={product.id} />
        </div>
        <p className="text-xs text-ink-faint">{product.categoryName ?? product.type}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm">
            {multiVariant && <span className="text-ink-faint">from </span>}
            <Price cents={minPrice} currency={product.currency} compareAtCents={product.compareAtCents} />
          </span>
          <Stars rating={product.ratingAvg} count={product.ratingCount} />
        </div>
      </div>
    </article>
  )
}
