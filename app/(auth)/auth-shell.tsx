import Link from 'next/link'

/** Shared centered shell for auth pages. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-14">
      <div className="mb-8 text-center">
        <Link href="/" className="font-display text-2xl font-semibold">
          Printique
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
      </div>
      <div className="card p-7 sm:p-8">{children}</div>
    </div>
  )
}
