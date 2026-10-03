/**
 * Next.js server bootstrap hook: run once per server process.
 * Ensures the database is migrated and background workers are alive.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { migrate } = await import('@/lib/db/client')
  migrate()
  const { startEmailWorker } = await import('@/lib/providers/email/queue')
  startEmailWorker()
}
