/**
 * Typed application errors. Route handlers convert these into the
 * consistent API error envelope; server components surface friendly pages.
 */

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_FAILED'
  | 'INSUFFICIENT_STOCK'
  | 'COUPON_INVALID'
  | 'UPLOAD_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INTERNAL'

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_FAILED: 402,
  INSUFFICIENT_STOCK: 409,
  COUPON_INVALID: 422,
  UPLOAD_INVALID: 422,
  IDEMPOTENCY_CONFLICT: 409,
  INTERNAL: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = statusByCode[code]
    this.details = details
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError('VALIDATION', message, details)
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
