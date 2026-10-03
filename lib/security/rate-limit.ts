/**
 * Fixed-window rate limiter (in-memory).
 *
 * Suitable for a single-instance deployment; the interface (key → decision)
 * drops in for a Redis-backed implementation when horizontal scaling demands it.
 * Buckets are periodically swept to bound memory.
 */

interface Bucket {
  windowStart: number
  count: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

export interface RateLimitDecision {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitDecision {
  const now = Date.now()
  // Opportunistic sweep of expired buckets (every 5 minutes).
  if (now - lastSweep > 5 * 60 * 1000) {
    for (const [k, b] of buckets) {
      if (now - b.windowStart > 60 * 60 * 1000) buckets.delete(k)
    }
    lastSweep = now
  }

  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowSeconds * 1000) {
    buckets.set(key, { windowStart: now, count: 1 })
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - 1 }
  }
  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowSeconds * 1000 - now) / 1000)
    return { allowed: false, retryAfterSeconds, remaining: 0 }
  }
  bucket.count++
  return { allowed: true, retryAfterSeconds: 0, remaining: limit - bucket.count }
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear()
}
