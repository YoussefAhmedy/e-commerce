import { api, ok } from '@/lib/http/api'
import { categories } from '@/lib/services/catalog'

export const GET = api(async () => ok({ categories: categories() }))
