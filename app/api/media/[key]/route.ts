import fs from 'node:fs'
import { NextResponse } from 'next/server'
import { api } from '@/lib/http/api'
import { getStorageProvider } from '@/lib/providers/storage/local'
import { getUploadByKey } from '@/lib/db/repositories/engagement'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/**
 * Serves user-uploaded custom-print images by opaque storage key.
 * Keys are validated + resolved server-side; no path ever comes from the client.
 */
export const GET = api(async (_request: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params
  const storage = getStorageProvider()
  const full = storage.resolve(key)
  if (!full) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 })
  }
  const upload = getUploadByKey(key)
  const ext = key.split('.').pop() ?? 'jpg'
  const buffer = fs.readFileSync(full)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': upload?.mime ?? MIME_BY_EXT[ext] ?? 'application/octet-stream',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
