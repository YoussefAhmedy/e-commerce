import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight, Frame, ImagePlus, Leaf, Ruler, ShieldCheck, Truck } from 'lucide-react'
import { queryCatalog, listCategories } from '@/lib/db/repositories/products'
import { trending } from '@/lib/services/recommendations'
import { ProductCard } from '@/components/storefront/product-card'
import { site } from '@/lib/config/site'

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
  alternates: { canonical: '/' },
}

export const dynamic = 'force-dynamic'

const PROMISES = [
  { icon: ShieldCheck, title: 'Archival-grade quality', body: 'Museum-weight paper, pigment inks rated for 100+ years, hand-checked before framing.' },
  { icon: Frame, title: 'Bespoke framing', body: 'Every frame is cut to order from sustainably sourced oak, walnut and metal.' },
  { icon: Truck, title: 'Careful delivery', body: 'Flat-packed, corner-protected, tracked. Free shipping on orders over $100.' },
] as const

export default async function HomePage() {
  const categories = listCategories()
  const { products: featured } = queryCatalog({ featuredOnly: true, pageSize: 8 })
  const popular = trending(8)
  const showTrending = popular.length >= 4 ? popular : featured

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--color-clay-100),transparent),radial-gradient(40rem_26rem_at_-10%_20%,var(--color-sand),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
          <div>
            <p className="chip mb-6">Custom prints · made to order</p>
            <h1 className="font-display text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Your walls,
              <br />
              <span className="text-clay-600">your story.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Turn your photos into gallery-grade framed art — or choose from a curated
              collection of prints, cut and framed to order in our studio.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={'/custom' as never} className="btn-accent !px-7 !py-3.5 text-base">
                <ImagePlus size={18} aria-hidden /> Start with your photo
              </Link>
              <Link href={'/catalog' as never} className="btn-secondary !px-7 !py-3.5 text-base">
                Browse the collection <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {featured.slice(0, 4).map((p, i) => (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}` as never}
                  className={`block overflow-hidden rounded-3xl shadow-soft transition-transform hover:-translate-y-1 ${i % 2 === 1 ? 'translate-y-8' : ''}`}
                >
                  <div className="relative aspect-[4/5] bg-cream">
                    {p.images[0] && (
                      <Image src={p.images[0].url} alt={p.images[0].alt || p.name} fill sizes="20vw" className="object-cover" priority={i < 2} />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Promises ─────────────────────────────────────── */}
      <section aria-label="Why Printique" className="border-y border-line bg-white/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
                <Icon size={20} aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trending ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="trending">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 id="trending" className="font-display text-3xl font-semibold tracking-tight">Trending this week</h2>
            <p className="mt-1.5 text-sm text-ink-soft">What the community is hanging on their walls.</p>
          </div>
          <Link href={'/catalog' as never} className="btn-ghost hidden shrink-0 sm:inline-flex">
            View all <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {showTrending.slice(0, 4).map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-labelledby="categories">
        <h2 id="categories" className="mb-8 font-display text-3xl font-semibold tracking-tight">Shop by category</h2>
        <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/catalog?category=${c.slug}` as never}
              className="group relative w-64 shrink-0 overflow-hidden rounded-3xl sm:w-auto"
            >
              <div className="relative aspect-[16/10] bg-sand">
                {c.imageUrl && (
                  <Image src={c.imageUrl} alt={c.name} fill sizes="(max-width: 640px) 65vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-xl font-semibold text-white">{c.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-white/80">
                    Explore <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Custom studio banner ─────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink text-paper">
          <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-clay-600/30 blur-3xl" />
          <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="chip !border-white/15 !bg-white/10 !text-paper/90 mb-5">Custom studio</p>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                From camera roll to gallery wall, in three steps.
              </h2>
              <ol className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: ImagePlus, step: 'Upload', body: 'Your photo, re-encoded and color-prepped by us.' },
                  { icon: Ruler, step: 'Size', body: 'From desk-friendly 30×40 to statement 70×100.' },
                  { icon: Frame, step: 'Frame', body: 'Hand-cut oak, walnut or metal — previewed live.' },
                ].map(({ icon: Icon, step, body }, i) => (
                  <li key={step} className="rounded-2xl bg-white/5 p-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-clay-300">Step {i + 1}</span>
                    <h3 className="mt-1 flex items-center gap-2 font-semibold"><Icon size={16} aria-hidden /> {step}</h3>
                    <p className="mt-1 text-sm text-paper/70">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col items-start gap-4 lg:items-center">
              <Leaf className="h-10 w-10 text-clay-300" aria-hidden />
              <p className="max-w-xs text-sm leading-relaxed text-paper/70 lg:text-center">
                Every custom order plants one tree through our reforestation partner.
              </p>
              <Link href={'/custom' as never} className="btn-accent !px-7 !py-3.5">
                Create my print
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured grid ────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6" aria-labelledby="featured">
        <h2 id="featured" className="mb-8 font-display text-3xl font-semibold tracking-tight">From the collection</h2>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {featured.slice(4, 12).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href={'/catalog' as never} className="btn-primary !px-8 !py-3.5">
            Explore the full collection
          </Link>
        </div>
      </section>
    </div>
  )
}
