'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { saveCategory, deleteCategory } from '@/app/admin/actions'
import type { Category } from '@/lib/db/types'

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

interface Draft { id?: string; slug: string; name: string; description: string; imageUrl: string; position: number }
const EMPTY: Draft = { slug: '', name: '', description: '', imageUrl: '', position: 0 }

export function CategoryPanel({ initial }: { initial: Category[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openEdit(c?: Category) {
    setError(null)
    setEditing(c
      ? { id: c.id, slug: c.slug, name: c.name, description: c.description ?? '', imageUrl: c.imageUrl ?? '', position: c.position }
      : { ...EMPTY, position: initial.length })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    startTransition(async () => {
      const res = await saveCategory({
        slug: editing.slug || slugify(editing.name),
        name: editing.name,
        description: editing.description || null,
        imageUrl: editing.imageUrl || null,
        position: editing.position,
      }, editing.id)
      if (!res.ok) { setError(res.error); return }
      setEditing(null)
      router.refresh()
    })
  }

  function remove(c: Category) {
    if (!window.confirm(`Delete “${c.name}”? Products keep their data but lose this grouping.`)) return
    startTransition(async () => {
      const res = await deleteCategory(c.id)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => openEdit()} className="btn-primary gap-1.5">
          <Plus size={16} aria-hidden /> New category
        </button>
      </div>
      {error && !editing && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {editing && (
        <form onSubmit={submit} className="card grid gap-3 border-clay-200 p-5 sm:grid-cols-2" aria-label="Category form">
          <div>
            <label className="label" htmlFor="cat-name">Name</label>
            <input id="cat-name" className="input" required maxLength={80} value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="cat-slug">Slug</label>
            <input id="cat-slug" className="input font-mono text-sm" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cat-desc">Description</label>
            <input id="cat-desc" className="input" maxLength={400} value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cat-img">Image URL <span className="font-normal text-ink-faint">(optional)</span></label>
            <input id="cat-img" className="input" maxLength={500} value={editing.imageUrl}
              onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cat-pos">Sort position</label>
            <input id="cat-pos" className="input" type="number" min={0} value={editing.position}
              onChange={(e) => setEditing({ ...editing, position: parseInt(e.target.value, 10) || 0 })} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-ghost"><X size={14} aria-hidden /> Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-line">
        {initial.map((c) => (
          <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="truncate text-xs text-ink-faint">/{c.slug}{c.description ? ` · ${c.description}` : ''}</p>
            </div>
            <span className="chip">position {c.position}</span>
            <button type="button" onClick={() => openEdit(c)} className="btn-ghost !px-2.5 !py-1.5 text-xs" aria-label={`Edit ${c.name}`}>
              <Pencil size={14} aria-hidden />
            </button>
            <button type="button" disabled={pending} onClick={() => remove(c)} className="btn-ghost !px-2.5 !py-1.5 text-xs text-ink-faint hover:text-red-600" aria-label={`Delete ${c.name}`}>
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        ))}
        {initial.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">Nothing here yet.</p>}
      </div>
    </div>
  )
}
