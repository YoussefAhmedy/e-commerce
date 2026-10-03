import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Minimal structured JSON logger (stdout). Compatible with any log drain —
 * each line is one JSON object with level, msg, ts and contextual fields.
 *
 * Rules:
 *  - never log secrets, tokens, passwords or card data
 *  - carry requestId via AsyncLocalStorage (set in route wrapper/middleware)
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  [key: string]: unknown
}

export const requestContext = new AsyncLocalStorage<LogContext>()

function write(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  const store = requestContext.getStore()
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    requestId: store?.requestId,
    ...ctx,
  }
  const out = JSON.stringify(line)
  if (level === 'error') console.error(out)
  else if (level === 'warn') console.warn(out)
  else console.log(out)
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    process.env.NODE_ENV !== 'production' && write('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write('error', msg, ctx),
}

/** Wrap an async operation with a request-scoped logging context. */
export function withRequestContext<T>(ctx: LogContext, fn: () => T): T {
  return requestContext.run(ctx, fn)
}
