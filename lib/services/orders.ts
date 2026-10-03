import { env } from '@/lib/config/env'
import { AppError } from '@/lib/domain/errors'
import { hmacSha256, safeEqual } from '@/lib/domain/ids'
import { applyTransition, canTransition, type OrderAction } from '@/lib/domain/order-fsm'
import { withTransaction, newId } from '@/lib/db'
import * as cartsRepo from '@/lib/db/repositories/carts'
import * as ordersRepo from '@/lib/db/repositories/orders'
import { createNotification, trackEvent, audit, getUpload } from '@/lib/db/repositories/engagement'
import { findUserById } from '@/lib/db/repositories/users'
import type { AddressInput, Cart, Coupon, Order, OrderItem, PublicUser } from '@/lib/db/types'
import { checkCoupon, normalizeCode } from '@/lib/domain/coupons'
import { computeTotals, priceLine } from '@/lib/domain/pricing'
import { getPaymentProvider, getPaymentProviderByName, type VerifiedPaymentEvent } from '@/lib/providers/payments'
import { enqueueTemplatedEmail } from '@/lib/providers/email/queue'
import { releaseStock, reserveStock, sellReservedStock } from './inventory'

/**
 * Order service — the transactional heart of the store.
 *
 * Integrity rules:
 *  - totals are recomputed from the live catalog at order creation
 *  - order creation is idempotent (client idempotency key → UNIQUE column)
 *  - stock is reserved atomically with the order insert
 *  - payment confirmation arrives ONLY through verified, idempotent webhooks
 *  - order rows are immutable snapshots: names/SKUs/prices freeze at purchase
 */

/** Signed guest token so order-confirmation works without an account. */
export function orderAccessToken(orderId: string): string {
  return hmacSha256(env.APP_SECRET, `order:${orderId}`).slice(0, 40)
}

export function verifyOrderAccessToken(orderId: string, token: string): boolean {
  return safeEqual(orderAccessToken(orderId), token)
}

export interface CreateOrderInput {
  idempotencyKey: string
  email: string | null
  shippingAddress: AddressInput
  couponCode?: string
}

export function createOrderFromCart(cart: Cart, user: PublicUser | null, input: CreateOrderInput): { order: Order; isReplay: boolean } {
  if (cart.lines.length === 0) throw new AppError('VALIDATION', 'Your cart is empty.')
  const email = user?.email ?? input.email
  if (!email) throw new AppError('VALIDATION', 'An email address is required for order updates.')

  // Replay-safe: the same idempotency key returns the original order.
  const existing = ordersRepo.getOrderByIdempotencyKey(input.idempotencyKey)
  if (existing) return { order: existing, isReplay: true }

  return withTransaction(() => {
    // Double-check inside the transaction (a concurrent retry may have landed first).
    const raced = ordersRepo.getOrderByIdempotencyKey(input.idempotencyKey)
    if (raced) return { order: raced, isReplay: true }

    // Re-validate the coupon against the true subtotal at this instant.
    const lines = cart.lines.map((l) => priceLine(l.unitPriceCents, l.quantity))
    const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0)
    let coupon: Coupon | null = null
    if (input.couponCode) {
      const candidate = ordersRepo.findCouponByCode(normalizeCode(input.couponCode))
      const counts = candidate
        ? ordersRepo.countCouponRedemptions(candidate.id, user?.id ?? null)
        : { total: 0, byUser: 0 }
      const check = checkCoupon(candidate, {
        subtotalCents: subtotal,
        userId: user?.id ?? null,
        userRedemptions: counts.byUser,
        totalRedemptions: counts.total,
        now: new Date(),
      })
      if (!check.ok) throw new AppError('COUPON_INVALID', check.message)
      coupon = check.coupon
    }

    // Reserve stock atomically (throws INSUFFICIENT_STOCK → whole tx rolls back).
    for (const line of cart.lines) reserveStock(line.variantId, line.quantity)

    // Snapshot items — purchase-time prices and names are frozen forever.
    const items: Array<Omit<OrderItem, 'id' | 'orderId'>> = cart.lines.map((l) => {
      const options: Record<string, string> = { variant: l.variantName }
      if (l.customization?.frameVariantId) options['framing'] = 'Custom framing included'
      if (l.customization?.note) options['note'] = l.customization.note
      if (l.customization?.uploadId) {
        const upload = getUpload(l.customization.uploadId)
        options['custom upload'] = upload?.originalName ?? 'customer image'
      }
      return {
        productId: l.productId,
        variantId: l.variantId,
        name: l.productName,
        sku: l.sku,
        options,
        previewUrl: l.imageUrl,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.unitPriceCents * l.quantity,
      }
    })

    const totals = computeTotals(lines, coupon)
    const order = ordersRepo.insertOrder(
      {
        id: newId(),
        number: ordersRepo.nextOrderNumber(),
        userId: user?.id ?? null,
        guestEmail: user ? null : email,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        currency: env.CURRENCY,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        shippingAddress: input.shippingAddress,
        shippingMethod: 'STANDARD',
        trackingNumber: null,
        carrier: null,
        idempotencyKey: input.idempotencyKey,
        placedAt: new Date().toISOString(),
      },
      items,
    )

    if (coupon) ordersRepo.recordCouponRedemption(coupon.id, user?.id ?? null, order.id)
    cartsRepo.markCartCheckedOut(cart.id)
    audit({
      actorId: user?.id ?? null,
      action: 'ORDER_CREATED',
      entity: 'order',
      entityId: order.id,
      meta: { number: order.number, totalCents: order.totalCents },
    })
    return { order, isReplay: false }
  })
}

export interface PaymentSession {
  checkoutUrl: string | null
  clientSecret: string | null
  provider: string
}

/** Create a payment intent with the configured provider + record it. */
export async function initiatePayment(order: Order): Promise<PaymentSession> {
  if (order.paymentStatus !== 'PENDING') {
    throw new AppError('CONFLICT', 'This order is not awaiting payment.')
  }
  const provider = getPaymentProvider()
  const intent = await provider.createIntent({
    orderId: order.id,
    orderNumber: order.number,
    amountCents: order.totalCents,
    currency: order.currency,
    description: `Printique order ${order.number}`,
    returnUrl: `${env.SITE_URL}/order-confirmation/${order.number}`,
  })
  ordersRepo.insertPayment({
    orderId: order.id,
    provider: provider.name,
    intentId: intent.intentId,
    amountCents: order.totalCents,
    currency: order.currency,
  })
  return { provider: provider.name, checkoutUrl: intent.checkoutUrl, clientSecret: intent.clientSecret }
}

/**
 * Webhook entry point. Verifies the signature, idempotently records the
 * event, then applies the state transition + side effects exactly once.
 */
export async function handlePaymentWebhook(
  providerName: string,
  rawBody: string,
  headers: Headers,
): Promise<{ status: 'processed' | 'duplicate' | 'ignored'; event: VerifiedPaymentEvent }> {
  const provider = getPaymentProviderByName(providerName)
  const event = provider.verifyWebhook(rawBody, headers) // throws on bad signature

  // Idempotency gate — replays are acknowledged but never re-fulfill.
  const isNew = ordersRepo.recordPaymentEvent({
    provider: provider.name,
    eventId: event.eventId,
    orderId: event.orderId,
    type: event.type,
    payload: rawBody.slice(0, 4000),
  })
  if (!isNew) return { status: 'duplicate', event }

  const order = ordersRepo.getOrderById(event.orderId)
  if (!order) {
    ordersRepo.markPaymentEventProcessed(provider.name, event.eventId, 'IGNORED')
    return { status: 'ignored', event }
  }

  // Amount/currency cross-check — a valid webhook billing the wrong amount
  // (replay against another intent, provider-side bug, crafted event) must
  // never mark an order paid. Audited loudly for investigation.
  if (event.type === 'PAYMENT_SUCCEEDED' &&
      (event.amountCents !== order.totalCents || event.currency !== order.currency)) {
    ordersRepo.markPaymentEventProcessed(provider.name, event.eventId, 'IGNORED')
    auditPaymentMismatch(order, event)
    return { status: 'ignored', event }
  }

  try {
    if (event.type === 'PAYMENT_SUCCEEDED') {
      markOrderPaid(order, provider.name, event)
    } else {
      markOrderPaymentFailed(order, provider.name, event)
    }
    ordersRepo.markPaymentEventProcessed(provider.name, event.eventId, 'PROCESSED')
    return { status: 'processed', event }
  } catch (err) {
    ordersRepo.markPaymentEventProcessed(provider.name, event.eventId, 'FAILED')
    throw err
  }
}

function auditPaymentMismatch(order: Order, event: VerifiedPaymentEvent): void {
  audit({
    actorId: null,
    action: 'PAYMENT_AMOUNT_MISMATCH',
    entity: 'order',
    entityId: order.id,
    meta: {
      number: order.number,
      expectedCents: order.totalCents,
      eventCents: event.amountCents,
      eventCurrency: event.currency,
      intentId: event.intentId,
    },
  })
}

function orderContactEmail(order: Order): string {
  if (order.guestEmail) return order.guestEmail
  if (order.userId) return findUserById(order.userId)?.email ?? 'customer@printique.invalid'
  return 'customer@printique.invalid'
}

function markOrderPaid(order: Order, providerName: string, event: VerifiedPaymentEvent): void {
  const transitioned = withTransaction(() => {
    const fresh = ordersRepo.getOrderById(order.id)!
    // A racing webhook may have paid this order already — the FSM guard denies.
    if (!canTransition(fresh, 'MARK_PAID')) return null
    const t = applyTransition(fresh, 'MARK_PAID')
    ordersRepo.applyOrderPatch(fresh.id, t)
    ordersRepo.updatePaymentStatus(providerName, event.intentId, 'SUCCEEDED')
    sellReservedStock(fresh.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })))
    return fresh
  })
  if (!transitioned) return

  enqueueTemplatedEmail(orderContactEmail(transitioned), 'ORDER_CONFIRMATION', {
    name: transitioned.shippingAddress.firstName,
    orderNumber: transitioned.number,
    totalCents: transitioned.totalCents,
    currency: transitioned.currency,
    orderUrl: `${env.SITE_URL}/order-confirmation/${transitioned.number}?k=${orderAccessToken(transitioned.id)}`,
    lines: transitioned.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
  })
  if (transitioned.userId) {
    createNotification({
      userId: transitioned.userId,
      type: 'ORDER_PAID',
      title: `Order ${transitioned.number} confirmed`,
      body: 'Payment received — your prints are heading to the studio.',
      data: { number: transitioned.number },
    })
  }
  trackEvent('PURCHASE', {
    userId: transitioned.userId ?? undefined,
    meta: { number: transitioned.number, totalCents: String(transitioned.totalCents) },
  })
  audit({
    actorId: null,
    action: 'PAYMENT_SUCCEEDED',
    entity: 'order',
    entityId: transitioned.id,
    meta: { number: transitioned.number, provider: providerName },
  })
}

function markOrderPaymentFailed(order: Order, providerName: string, event: VerifiedPaymentEvent): void {
  withTransaction(() => {
    const fresh = ordersRepo.getOrderById(order.id)!
    if (!canTransition(fresh, 'MARK_PAYMENT_FAILED')) return
    const t = applyTransition(fresh, 'MARK_PAYMENT_FAILED')
    ordersRepo.applyOrderPatch(fresh.id, t)
    ordersRepo.updatePaymentStatus(providerName, event.intentId, 'FAILED')
    for (const item of fresh.items) {
      if (item.variantId) releaseStock(item.variantId, item.quantity)
    }
    audit({
      actorId: null,
      action: 'PAYMENT_FAILED',
      entity: 'order',
      entityId: order.id,
      meta: { number: order.number, provider: providerName },
    })
    return true
  })
  if (order.userId) {
    createNotification({
      userId: order.userId,
      type: 'PAYMENT_FAILED',
      title: `Payment for order ${order.number} didn't go through`,
      body: 'Your reserved items were released. You can retry checkout whenever you’re ready.',
      data: { number: order.number },
    })
  }
}

// ── lifecycle actions (admin + customer cancellation) ──────────────────

export function transitionOrder(
  orderId: string,
  action: OrderAction,
  actor: PublicUser,
  extra?: { trackingNumber?: string; carrier?: string },
): Order {
  const result = withTransaction(() => {
    const order = ordersRepo.getOrderById(orderId)
    if (!order) throw new AppError('NOT_FOUND', 'Order not found.')
    const t = applyTransition(order, action)
    ordersRepo.applyOrderPatch(orderId, {
      ...t,
      trackingNumber: extra?.trackingNumber,
      carrier: extra?.carrier,
    })
    if (action === 'CANCEL' || action === 'REFUND') {
      for (const item of order.items) {
        if (item.variantId) releaseStock(item.variantId, item.quantity)
      }
    }
    audit({
      actorId: actor.id,
      action: `ORDER_${action}`,
      entity: 'order',
      entityId: orderId,
      meta: { number: order.number },
    })
    return ordersRepo.getOrderById(orderId)!
  })

  if (action === 'SHIP') {
    enqueueTemplatedEmail(orderContactEmail(result), 'ORDER_SHIPPED', {
      name: result.shippingAddress.firstName,
      orderNumber: result.number,
      trackingNumber: extra?.trackingNumber ?? null,
      carrier: extra?.carrier ?? null,
    })
    if (result.userId) {
      createNotification({
        userId: result.userId,
        type: 'ORDER_SHIPPED',
        title: `Order ${result.number} is on its way`,
        body: extra?.trackingNumber ? `Tracking ${extra.trackingNumber}` : 'Your prints have shipped.',
        data: { number: result.number },
      })
    }
  }
  return result
}

/** Customer self-cancellation: only their own pre-paid orders. */
export function cancelOwnOrder(orderId: string, user: PublicUser): Order {
  const order = ordersRepo.getOrderById(orderId)
  if (!order || order.userId !== user.id) throw new AppError('NOT_FOUND', 'Order not found.')
  return transitionOrder(orderId, 'CANCEL', user)
}

/** AuthZ helper: may this principal see this order? (owner, admin, or guest link token) */
export function canViewOrder(order: Order, user: PublicUser | null, accessToken?: string | null): boolean {
  if (user?.role === 'ADMIN') return true
  if (user && order.userId === user.id) return true
  if (accessToken && verifyOrderAccessToken(order.id, accessToken)) return true
  return false
}
