import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError, isAppError } from '@/lib/domain/errors'
import { log, withRequestContext } from '@/lib/observability/logger'

/**
 * Consistent API envelope + error handling.
 *
 * Every route handler wrapped in `api()` gets:
 *  - a request-scoped logging context (requestId from middleware)
 *  - a uniform success shape  { ok: true, data }
 *  - a uniform error shape    { ok: false, error: { code, message, details? } }
 *  - zero stack traces / internals leaked to clients
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init)
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Please review the highlighted fields.',
          details: err.flatten().fieldErrors,
        },
      },
      { status: 422 },
    )
  }
  if (isAppError(err)) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    )
  }
  log.error('unhandled route error', {
    error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
  })
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } },
    { status: 500 },
  )
}

type RouteCtx = { params: Promise<Record<string, string>> }

export function api<Args extends [Request, ...unknown[]]>(
  handler: (...args: Args) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: Args): Promise<NextResponse> => {
    const request = args[0]
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    return withRequestContext({ requestId }, async () => {
      try {
        return await handler(...args)
      } catch (err) {
        return toErrorResponse(err)
      }
    })
  }
}

/** Parse + validate a JSON body with zod; throws ZodError → 422 envelope. */
export async function parseJson<T>(request: Request, schema: { parse: (input: unknown) => T }): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new AppError('VALIDATION', 'Request body must be valid JSON.')
  }
  return schema.parse(raw)
}

export { type RouteCtx }
