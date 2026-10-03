import { env } from '@/lib/config/env'
import { AppError } from '@/lib/domain/errors'
import { MockPaymentProvider } from './mock'
import { StripePaymentProvider } from './stripe'
import type { PaymentProvider } from './types'

/** Factory — provider is selected by configuration, never by request input. */
export function getPaymentProvider(name?: string): PaymentProvider {
  const selected = name ?? env.PAYMENT_PROVIDER
  switch (selected) {
    case 'stripe':
      return new StripePaymentProvider()
    case 'mock':
      return new MockPaymentProvider()
    default:
      throw new AppError('INTERNAL', `Unknown payment provider "${selected}".`)
  }
}

export function getPaymentProviderByName(name: string): PaymentProvider {
  if (name === 'mock') return new MockPaymentProvider()
  if (name === 'stripe') return new StripePaymentProvider()
  throw new AppError('NOT_FOUND', 'Unknown payment provider.')
}

export * from './types'
