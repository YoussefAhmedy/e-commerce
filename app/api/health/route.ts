import { api, ok } from '@/lib/http/api'

/**
 * Liveness — is the process up and serving?
 * Readiness (with dependency checks) lives at /api/health/ready.
 */
export const GET = api(async () =>
  ok({ status: 'ok', service: 'printique', uptimeSeconds: Math.round(process.uptime()) }),
)
