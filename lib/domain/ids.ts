import crypto from 'node:crypto'

/** UUIDv4 for primary keys. */
export function newId(): string {
  return crypto.randomUUID()
}

/** URL-safe opaque token (cookies, guest carts, auth tokens). */
export function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/** sha256 hex — stored instead of raw tokens so a DB leak ≠ session leak. */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/** Constant-time string compare for HMAC verification. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function hmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}
