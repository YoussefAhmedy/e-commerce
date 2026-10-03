import type { Metadata } from 'next'
import { listCategories } from '@/lib/db/repositories/products'
import { ProductForm } from '../product-form'

export const metadata: Metadata = { title: 'New product' }
export const dynamic = 'force-dynamic'

export default function NewProductPage() {
  const categories = listCategories()
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">New product</h1>
      <p className="mt-1 text-sm text-ink-soft">Drafts stay invisible to shoppers until you publish.</p>
      <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  )
}
