import type { Metadata } from 'next'
import { listCategories } from '@/lib/db/repositories/products'
import { AiToolForm } from './ai-tool-form'

export const metadata: Metadata = { title: 'AI content tools' }
export const dynamic = 'force-dynamic'

export default function AdminAiToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">AI content tools</h1>
        <p className="max-w-2xl text-sm text-ink-soft">
          Draft product copy with the catalog-context generator. Every output is a reviewed draft — editing is the point.
          Without an AI key the tools use an offline template mode and say so.
        </p>
      </div>
      <AiToolForm categories={listCategories().map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  )
}
