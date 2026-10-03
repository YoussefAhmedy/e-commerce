import path from 'node:path'
import { z } from 'zod'

/**
 * Centralized, validated environment configuration.
 * Import `env` — never read process.env directly from feature code.
 */
const envSchema = z.object({
  // Statically scoped subfolder keeps Turbopack tracing clean — set DATA_DIR
  // to a subfolder name (e.g. '.data'); production uses the container volume.
  DATA_DIR: z.string().default('.data'),
  SITE_URL: z.url().default('http://localhost:3000'),
  APP_SECRET: z.string().min(16).default('dev-only-secret-change-in-prod'),

  PAYMENT_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Printique <hello@printique.example>'),

  AI_PROVIDER: z.enum(['none', 'openai-compatible']).default('none'),
  AI_BASE_URL: z.url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_RATE_LIMIT: z.coerce.number().int().positive().default(30),

  TAX_RATE: z.coerce.number().min(0).max(0.5).default(0.08),
  SHIPPING_FLAT_CENTS: z.coerce.number().int().min(0).default(999),
  FREE_SHIPPING_THRESHOLD_CENTS: z.coerce.number().int().min(0).default(10000),
  CURRENCY: z.string().length(3).default('USD'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

type Env = z.infer<typeof envSchema> & {
  absoluteDataDir: string
  databasePath: string
  uploadsDir: string
  isProd: boolean
}

function load(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    // Fail fast at startup with a clear message instead of undefined behavior later.
    console.error('Invalid environment configuration:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Environment validation failed')
  }
  const e = parsed.data
  const absoluteDataDir = path.isAbsolute(e.DATA_DIR)
    ? e.DATA_DIR
    : path.join(/*turbopackIgnore: true*/ process.cwd(), e.DATA_DIR)
  return {
    ...e,
    absoluteDataDir,
    databasePath: path.join(absoluteDataDir, 'printique.db'),
    uploadsDir: path.join(absoluteDataDir, 'uploads'),
    isProd: e.NODE_ENV === 'production',
  }
}

/** Lazy singleton so tests can override the data dir before first access. */
let cached: Env | null = null
export function getEnv(): Env {
  if (!cached) cached = load()
  return cached
}

/** Test hook — resets the cached singleton. */
export function resetEnvForTests(): void {
  cached = null
}

export const env = new Proxy({} as Env, {
  get(_t, prop: keyof Env) {
    return getEnv()[prop]
  },
})
