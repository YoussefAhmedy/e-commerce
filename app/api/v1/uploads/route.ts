import { api, ok } from '@/lib/http/api'
import { commerce } from '@/lib/config/commerce'
import { AppError } from '@/lib/domain/errors'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin, userIp } from '@/lib/security/guard'
import { getSessionUser } from '@/lib/security/session'
import { createUpload } from '@/lib/db/repositories/engagement'
import { getStorageProvider, probeImage } from '@/lib/providers/storage/local'

/**
 * Custom-print image uploads.
 * Validation: declared mime → byte size → magic bytes → sharp re-encode
 * (strips embedded payloads/EXIF). Stored under an opaque random key.
 */
const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP (webp marker checked loosely)
]

function sniffMime(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0x52 && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  for (const m of MAGIC) {
    if (m.mime === 'image/webp') continue
    if (head.length >= m.bytes.length && m.bytes.every((b, i) => head[i] === b)) return m.mime
  }
  return null
}

export const POST = api(async (request: Request) => {
  assertSameOrigin(request)
  const ip = userIp(request) ?? 'unknown'
  const limit = checkRateLimit(`upload:${ip}`, 20, 3600)
  if (!limit.allowed) throw new AppError('RATE_LIMITED', 'Too many uploads — try again in an hour.')

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new AppError('UPLOAD_INVALID', 'Attach a single image file.')
  if (!commerce.allowedUploadMimes.includes(file.type as (typeof commerce.allowedUploadMimes)[number])) {
    throw new AppError('UPLOAD_INVALID', 'Only JPEG, PNG or WebP images are accepted.')
  }
  if (file.size > commerce.maxUploadBytes) {
    throw new AppError('UPLOAD_INVALID', `Images must be under ${commerce.maxUploadBytes / 1024 / 1024} MB.`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffMime(buffer.subarray(0, 16))
  if (!sniffed) {
    throw new AppError('UPLOAD_INVALID', 'The file content is not a valid image.')
  }

  // Re-encode through sharp: canonicalizes format, strips metadata.
  const probe = await probeImage(buffer)

  const storage = getStorageProvider()
  const user = await getSessionUser()
  const saved = await storage.save({ buffer: probe.processed, mime: sniffed })
  const upload = createUpload({
    ownerUserId: user?.id ?? null,
    storageKey: saved.storageKey,
    mime: sniffed,
    sizeBytes: saved.sizeBytes,
    width: probe.width,
    height: probe.height,
    originalName: file.name.slice(0, 120),
  })

  return ok(
    {
      uploadId: upload.id,
      key: upload.storageKey,
      url: `/api/media/${upload.storageKey}`,
      width: upload.width,
      height: upload.height,
    },
    { status: 201 },
  )
})
