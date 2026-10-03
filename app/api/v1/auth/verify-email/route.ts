import { NextResponse } from 'next/server'
import { api } from '@/lib/http/api'
import { verifyEmailToken } from '@/lib/services/auth'
import { log } from '@/lib/observability/logger'

/** Email-link endpoint: verifies, then redirects with a human outcome. */
export const GET = api(async (request: Request) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? ''
  try {
    await verifyEmailToken(token)
    return NextResponse.redirect(new URL('/signin?verified=1', url.origin))
  } catch (err) {
    log.warn('email verification failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.redirect(new URL('/signin?verified=0', url.origin))
  }
})
