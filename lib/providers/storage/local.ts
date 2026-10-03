import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { env } from '@/lib/config/env'
import { AppError } from '@/lib/domain/errors'

/**
 * Storage abstraction — IStorageProvider implemented on local disk.
 * Keys are random + content-hashed; the API media route resolves keys to
 * files WITHOUT any user-controlled path component (traversal-proof).
 * An S3 adapter implements the same 3 methods.
 */

export interface StoredFile {
  storageKey: string
  sizeBytes: number
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export class LocalStorageProvider {
  private dir(): string {
    fs.mkdirSync(env.uploadsDir, { recursive: true })
    return env.uploadsDir
  }

  async save(input: { buffer: Buffer; mime: string }): Promise<StoredFile> {
    const ext = EXT_BY_MIME[input.mime]
    if (!ext) throw new AppError('UPLOAD_INVALID', 'Only JPEG, PNG or WebP images are accepted.')
    const hash = crypto.createHash('sha256').update(input.buffer).digest('hex').slice(0, 16)
    const key = `u_${crypto.randomUUID().replace(/-/g, '')}${hash}.${ext}`
    fs.writeFileSync(path.join(this.dir(), key), input.buffer, { flag: 'wx' })
    return { storageKey: key, sizeBytes: input.buffer.length }
  }

  /** Resolve a storage key to an absolute path, rejecting anything unexpected. */
  resolve(storageKey: string): string | null {
    if (!/^u_[a-z0-9]{48}\.(jpg|png|webp)$/.test(storageKey)) return null
    const full = path.join(this.dir(), storageKey)
    if (!full.startsWith(this.dir())) return null
    return fs.existsSync(full) ? full : null
  }
}

export function getStorageProvider(): LocalStorageProvider {
  return new LocalStorageProvider()
}

/** Image dimension probing via sharp (with graceful degradation). */
export async function probeImage(buffer: Buffer): Promise<{ width: number | null; height: number | null; processed: Buffer }> {
  try {
    const sharp = (await import('sharp')).default
    const image = sharp(buffer)
    const meta = await image.metadata()
    // Normalize: strip EXIF, cap at 4000px on the long edge, re-encode.
    const processed = await image
      .rotate()
      .resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    return { width: meta.width ?? null, height: meta.height ?? null, processed }
  } catch {
    return { width: null, height: null, processed: buffer }
  }
}
