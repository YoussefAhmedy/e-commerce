import { formatMoney } from '@/lib/domain/money'

export { formatMoney }

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', ...opts }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function statusTone(status: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  switch (status) {
    case 'PAID':
    case 'DELIVERED':
    case 'APPROVED':
    case 'CONFIRMED':
    case 'PUBLISHED':
      return 'good'
    case 'PENDING':
    case 'DRAFT':
    case 'PROCESSING':
      return 'info'
    case 'UNFULFILLED':
    case 'SHIPPED':
      return 'neutral'
    case 'FAILED':
    case 'REFUNDED':
    case 'CANCELLED':
    case 'REJECTED':
      return 'bad'
    case 'ARCHIVED':
      return 'warn'
    default:
      return 'neutral'
  }
}
