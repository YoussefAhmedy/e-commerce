import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { getSessionUser } from '@/lib/security/session'
import { listWishlistProductIds } from '@/lib/db/repositories/engagement'
import { getProductById } from '@/lib/db/repositories/products'
import { ProductCard } from '@/components/storefront/product-card'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
  const user = await getSessionUser()
  if (!user) redirect('/signin?next=/wishlist')

  const ids = listWishlistProductIds(user.id)
  const products = ids
    .map((id) => getProductById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.status === 'PUBLISHED'))

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Wishlist</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {products.length === 0 ? 'Pieces you save will show up here.' : `${products.length} saved ${products.length === 1 ? 'piece' : 'pieces'}.`}
      </p>
      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            body="Tap the heart on any piece you love — it will be saved to your account across devices."
            action={{ href: '/catalog', label: 'Discover the collection' }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
