import type { Metadata } from 'next'
import { listCategories } from '@/lib/db/repositories/products'
import { CategoryPanel } from './category-panel'

export const metadata: Metadata = { title: 'Categories' }
export const dynamic = 'force-dynamic'

export default function AdminCategoriesPage() {
  const categories = listCategories()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-ink-soft">
          {categories.length === 0
            ? 'Create your first collection to organize the catalog.'
            : 'Collections the storefront navigation and catalog filters group by.'}
        </p>
      </div>
      <CategoryPanel initial={categories} />
    </div>
  )
}
