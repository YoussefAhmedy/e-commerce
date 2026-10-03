import { api, ok } from '@/lib/http/api'
import { browse } from '@/lib/services/catalog'

/**
 * GET /api/v1/products?q=&category=&type=&min=&max=&color=&material=&size=&sort=&page=
 * Paginated catalog — never ships the whole dataset.
 */
export const GET = api(async (request: Request) => {
  const url = new URL(request.url)
  const result = browse(url.searchParams)
  return ok(result)
})
