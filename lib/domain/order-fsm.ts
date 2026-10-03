import type { FulfillmentStatus, Order, PaymentStatus } from '@/lib/db/types'
import { AppError } from './errors'

/**
 * Order lifecycle — a tiny, explicit finite-state machine.
 * Every transition is validated here; neither the browser nor an admin
 * form can move an order arbitrarily. Webhooks and admin actions both
 * funnels through these guards.
 */

export type OrderAction =
  | 'MARK_PAID'        // payment webhook
  | 'MARK_PAYMENT_FAILED'
  | 'START_PROCESSING' // admin
  | 'SHIP'             // admin
  | 'DELIVER'          // admin (or carrier webhook, future)
  | 'CANCEL'           // customer (pre-payment) / admin
  | 'REFUND'           // admin

export interface Transition {
  status?: Order['status']
  paymentStatus?: PaymentStatus
  fulfillmentStatus?: FulfillmentStatus
}

const transitions: Record<OrderAction, { guard: (o: Order) => boolean; to: Transition; whyDenied: string }> = {
  MARK_PAID: {
    guard: (o) => o.paymentStatus === 'PENDING' && o.status === 'PENDING',
    to: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    whyDenied: 'Order is not awaiting payment.',
  },
  MARK_PAYMENT_FAILED: {
    guard: (o) => o.paymentStatus === 'PENDING',
    to: { paymentStatus: 'FAILED' },
    whyDenied: 'Order is not awaiting payment.',
  },
  START_PROCESSING: {
    guard: (o) => o.status === 'CONFIRMED' && o.paymentStatus === 'PAID' && o.fulfillmentStatus === 'UNFULFILLED',
    to: { fulfillmentStatus: 'PROCESSING' },
    whyDenied: 'Only a paid, unfulfilled order can move to processing.',
  },
  SHIP: {
    guard: (o) => o.status === 'CONFIRMED' && o.fulfillmentStatus === 'PROCESSING',
    to: { fulfillmentStatus: 'SHIPPED' },
    whyDenied: 'An order must be in processing before it can ship.',
  },
  DELIVER: {
    guard: (o) => o.status === 'CONFIRMED' && o.fulfillmentStatus === 'SHIPPED',
    to: { fulfillmentStatus: 'DELIVERED' },
    whyDenied: 'Only a shipped order can be marked delivered.',
  },
  CANCEL: {
    guard: (o) =>
      (o.status === 'PENDING' && o.paymentStatus !== 'PAID') ||
      (o.status === 'CONFIRMED' && o.fulfillmentStatus === 'UNFULFILLED' && o.paymentStatus !== 'PAID'),
    to: { status: 'CANCELLED' },
    whyDenied: 'This order can no longer be cancelled.',
  },
  REFUND: {
    guard: (o) => o.paymentStatus === 'PAID' && o.status === 'CONFIRMED' && o.fulfillmentStatus !== 'DELIVERED',
    to: { paymentStatus: 'REFUNDED', status: 'CANCELLED' },
    whyDenied: 'Only a paid, undelivered order can be refunded from the admin panel.',
  },
}

export function canTransition(order: Order, action: OrderAction): boolean {
  return transitions[action].guard(order)
}

/** Apply a transition or throw CONFLICT with a human reason. */
export function applyTransition(order: Order, action: OrderAction): Transition {
  const t = transitions[action]
  if (!t.guard(order)) {
    throw new AppError('CONFLICT', t.whyDenied, { action, order: order.number })
  }
  return t.to
}

/** Actions still available for this order — used by the admin UI to render buttons. */
export function availableActions(order: Order): OrderAction[] {
  return (Object.keys(transitions) as OrderAction[]).filter((a) => transitions[a].guard(order))
}
