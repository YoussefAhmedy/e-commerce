/**
 * Deterministic SVG artwork for seeded products.
 * Each seed product gets unique generative art (not stock photography) so the
 * repo ships with zero licensing ambiguity and zero external image dependency.
 * Returns data:image/svg+xml URLs — fully offline, rv compatible with <img> and next/image (unoptimized flag).
 */

const PALETTES: string[][] = [
  ['#c96f4a', '#e8b08c', '#f5e6d8', '#8a4b32'],
  ['#3d5a80', '#98c1d9', '#e0fbfc', '#293241'],
  ['#2f5d50', '#6d9d8a', '#f0ead6', '#1d4438'],
  ['#b3563f', '#d98e6a', '#f2e3d5', '#7c3a2a'],
  ['#26232b', '#575060', '#e8e4df', '#0f0d12'],
  ['#274060', '#4c7da3', '#d9a441', '#1b2d45'],
  ['#3c6b47', '#79a884', '#e9f0df', '#26492e'],
  ['#8a5a89', '#c49bc2', '#f6edf5', '#5c3a5b'],
]

const rng = (seed: string) => {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function posterImage(slug: string): string {
  const r = rng(slug)
  const palette = PALETTES[Math.floor(r() * PALETTES.length)]!
  const w = 600; const h = 800
  const shapes: string[] = []
  const n = 3 + Math.floor(r() * 4)
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(r() * w); const cy = Math.floor(r() * h)
    const size = Math.floor(60 + r() * 220)
    const color = palette[Math.floor(r() * palette.length)]
    const opacity = (0.35 + r() * 0.5).toFixed(2)
    const kind = Math.floor(r() * 3)
    if (kind === 0) shapes.push(`<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${color}" opacity="${opacity}"/>`)
    else if (kind === 1) shapes.push(`<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size * 0.7}" rx="${size * 0.08}" fill="${color}" opacity="${opacity}" transform="rotate(${Math.floor(r() * 90) - 45} ${cx} ${cy})"/>`)
    else shapes.push(`<path d="M ${cx - size} ${cy} Q ${cx} ${cy - size * 1.4} ${cx + size} ${cy}" stroke="${color}" stroke-width="${Math.floor(8 + r() * 22)}" fill="none" opacity="${opacity}" stroke-linecap="round"/>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${palette[2]}"/>${shapes.join('')}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export function frameImage(slug: string): string {
  const r = rng(slug)
  const tones = ['#b9855e', '#2b2b2b', '#4a2f1e', '#e8e8e8', '#c9a44c']
  const tone = tones[Math.floor(r() * tones.length)]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#efe9df"/><rect x="90" y="90" width="420" height="420" fill="none" stroke="${tone}" stroke-width="46"/><rect x="140" y="140" width="320" height="320" fill="#f7f3ea"/><rect x="150" y="150" width="300" height="300" fill="none" stroke="${tone}22" stroke-width="4"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
