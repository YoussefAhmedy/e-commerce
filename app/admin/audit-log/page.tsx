import type { Metadata } from 'next'
import { ScrollText } from 'lucide-react'
import { listAuditLog } from '@/lib/db/repositories/engagement'
import { formatDateTime } from '@/lib/utils/format'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Audit log' }
export const dynamic = 'force-dynamic'

export default function AdminAuditLogPage() {
  const entries = listAuditLog(150)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-ink-soft">Security-relevant events and admin mutations, newest first (last {entries.length}).</p>
      </div>
      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events yet" body="Sign-ins, price changes, order transitions and moderation land here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Entity</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id ?? i} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{e.createdAt ? formatDateTime(e.createdAt) : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{e.action}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{[e.entity, e.entityId].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="max-w-72 truncate px-4 py-2.5 font-mono text-xs text-ink-faint">{e.meta ? e.meta.slice(0, 120) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
