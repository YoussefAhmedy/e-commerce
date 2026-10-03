import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cream">
        <Compass size={28} className="text-clay-600" aria-hidden />
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">This page wandered off the wall</h1>
      <p className="mt-3 text-ink-soft">
        The page you’re looking for doesn’t exist — maybe it was moved, or the link is broken.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href={'/' as never} className="btn-primary">Back to the studio</Link>
        <Link href={'/catalog' as never} className="btn-secondary">Browse the collection</Link>
      </div>
    </div>
  )
}
