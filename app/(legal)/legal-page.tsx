/** Shared legal page chrome — consistent, readable, sidebar-free. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-ink-faint">Last updated {updated}</p>
      <div
        className="prose-legal mt-8 space-y-4 text-[0.95rem] leading-relaxed text-ink-soft
          [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink
          [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5"
      >
        {children}
      </div>
    </div>
  )
}
