import { NextResponse, type NextRequest } from 'next/server'

/**
 * Request proxy (formerly "middleware"): assigns a correlation ID to
 * every request so logs, API responses and error reports share one
 * traceable identifier.
 */
export function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
