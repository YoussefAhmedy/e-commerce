#!/usr/bin/env tsx
/**
 * Seed the development database with a believable boutique catalog.
 *
 * IMPORTANT: seeds a LOCAL/dev database only. Never run against shared data.
 * Everything here is synthetic — names, emails, orders and reviews are
 * invented demo content, and all payments are mock intents.
 *
 * Usage: npm run db:seed          (uses DATABASE_PATH or default dev file)
 *        DATABASE_PATH=... npm run db:seed
 */
import { getDb, migrate, newId, newToken } from '../lib/db'
import { withTransaction } from '../lib/db'
import { hashPassword } from '../lib/security/passwords'
import { posterImage, frameImage } from './db-seed-images'

const now = () => new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString()

async function main() {
  const db = getDb()
  migrate()

  const seeded = db.prepare(`SELECT value FROM settings WHERE key = 'seeded_version'`).get() as { value: string } | undefined
  if (seeded?.value === '1') {
    console.log('ℹ Database already seeded (settings.seeded_version = 1). Re-run skipped.')
    console.log('  To reseed, delete the database file and run again.')
    return
  }

  console.log('Seeding Printique dev database…')

  const adminHash = await hashPassword('Printique!2026')
  const customerHash = await hashPassword('Printique!2026')

  withTransaction(() => {
    // ── Users ─────────────────────────────────────────────────────────────
    const adminId = newId()
    const customerId = newId()
    const customer2Id = newId()
    const insertUser = db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, email_verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    insertUser.run(adminId, 'admin@printique.test', 'Ada Osei', adminHash, 'ADMIN', daysAgo(120), daysAgo(120))
    insertUser.run(customerId, 'demo@printique.test', 'Maya Lindström', customerHash, 'CUSTOMER', daysAgo(90), daysAgo(90))
    insertUser.run(customer2Id, 'guest2@printique.test', 'Jonas Weber', customerHash, 'CUSTOMER', daysAgo(40), daysAgo(40))

    // ── Categories ────────────────────────────────────────────────────────
    const insertCategory = db.prepare(
      `INSERT INTO categories (id, slug, name, description, image_url, position) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    const catAbstract = newId()
    const catPhoto = newId()
    const catFrames = newId()
    insertCategory.run(catAbstract, 'abstract', 'Abstract & Geometric', 'Color fields, brush studies and quiet geometry.', null, 0)
    insertCategory.run(catPhoto, 'photography', 'Photographic Series', 'Limited photographic prints shot on film and large format.', null, 1)
    insertCategory.run(catFrames, 'frames', 'Frames', 'Solid-wood and aluminum frames, made to measure.', null, 2)

    // ── Products ──────────────────────────────────────────────────────────
    const insertProduct = db.prepare(
      `INSERT INTO products (id, slug, name, summary, description, category_id, type, status,
         base_price_cents, compare_at_cents, currency, tags, attributes, featured, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`,
    )
    const insertImage = db.prepare(
      `INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, ?)`,
    )
    const insertVariant = db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, name, options, price_delta_cents, stock, reserved, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    )

    type PosterSeed = {
      slug: string; name: string; summary: string; description: string
      categoryId: string; tags: string[]; attributes: Record<string, string>
      base: number; compareAt?: number; featured: boolean; sizes: Array<{ name: string; size: string; delta: number; stock: number }>
    }

    const POSTER_SIZES = [
      { name: 'A4 · 21×30 cm', size: '21x30', delta: 0, stock: 40 },
      { name: 'A3 · 30×40 cm', size: '30x40', delta: 1400, stock: 35 },
      { name: 'A2 · 40×50 cm', size: '40x50', delta: 2600, stock: 25 },
      { name: '50×70 cm', size: '50x70', delta: 4200, stock: 18 },
      { name: '61×91 cm', size: '61x91', delta: 6800, stock: 10 },
    ]

    const posters: PosterSeed[] = [
      { slug: 'golden-hour-dunes', name: 'Golden Hour Dunes', summary: 'Late light over a desert ridge, warm terracotta tones.', description: 'Shot on medium-format film at the crest of the Erg Chigaga ridge, Golden Hour Dunes holds the last ten minutes of light. The grain is preserved, not smoothed, so the print has a tactile, almost woven quality.\n\nPrinted on 200gsm matte archival stock with pigment inks, rated for a century in normal indoor light.', categoryId: catPhoto, tags: ['desert', 'warm', 'terracotta', 'landscape'], attributes: { color: 'terracotta', material: 'matte archival paper', orientation: 'portrait' }, base: 3900, featured: true, sizes: POSTER_SIZES },
      { slug: 'tide-lines-no-2', name: 'Tide Lines No. 2', summary: 'Aerial study of the tidal flats — pale blues and sand.', description: 'Part of an ongoing aerial series over the Wadden Sea. Tide Lines No. 2 was taken from 400m at low tide; the channels read like handwriting across the frame.\n\nA calm, quiet piece that holds its own at large sizes. 200gsm matte archival paper, pigment inks.', categoryId: catPhoto, tags: ['aerial', 'sea', 'blue', 'calm'], attributes: { color: 'blue', material: 'matte archival paper', orientation: 'landscape' }, base: 4200, featured: true, sizes: POSTER_SIZES },
      { slug: 'fern-atrium', name: 'Fern Atrium', summary: 'Botanical study — deep green fronds, soft studio light.', description: 'A slow botanical portrait made in a converted glasshouse studio. Each frond was lit individually over four hours, then composited into a single still.\n\nRich greens without the digital gloss — the matte stock keeps it painterly. 200gsm archival matte.', categoryId: catPhoto, tags: ['botanical', 'green', 'studio', 'fern'], attributes: { color: 'green', material: 'matte archival paper', orientation: 'portrait' }, base: 3600, featured: true, sizes: POSTER_SIZES },
      { slug: 'ochre-fields', name: 'Ochre Fields', summary: 'Minimal color-field study in ochre, sand and bone.', description: 'Hand-painted in gouache, then scanned at 1200dpi and proofed on the exact stock it ships on. Ochre Fields is about restraint — three weights of warm neutral, one horizon.\n\nPairs well with warm woods and linen. 200gsm matte archival paper.', categoryId: catAbstract, tags: ['abstract', 'minimal', 'ochre', 'color-field'], attributes: { color: 'ochre', material: 'matte archival paper', orientation: 'portrait' }, base: 3400, featured: true, sizes: POSTER_SIZES },
      { slug: 'brush-5', name: 'Brush Study 05', summary: 'Single-gesture ink brushwork on textured stock.', description: 'One breath, one stroke. Brush Study 05 is a single-gesture work in sumi ink, reproduced at 1:1 scale from the original on textured 300gsm fine-art stock.\n\nThe texture of the original washi carries through the print — you can feel the tooth of the paper.', categoryId: catAbstract, tags: ['ink', 'gestural', 'black', 'minimal'], attributes: { color: 'black', material: 'textured fine-art paper', orientation: 'portrait' }, base: 3800, featured: false, sizes: POSTER_SIZES },
      { slug: 'grid-city-night', name: 'Grid City — Night', summary: 'Geometric city study; midnight blue with lit windows.', description: 'A geometric reduction of a city block after dark — forty-six lit windows against midnight blue. Screenprinted in three passes, this is Grid City — Night, a limited-edition study of urban rhythm.\n\nDeep inks on 270gsm cotton-rag stock; the blues pull toward violet under warm light.', categoryId: catAbstract, tags: ['city', 'geometric', 'blue', 'night'], attributes: { color: 'navy', material: 'cotton-rag stock', orientation: 'square' }, base: 4800, compareAt: 5600, featured: true, sizes: POSTER_SIZES },
      { slug: 'moss-granite', name: 'Moss & Granite', summary: 'Macro study of moss on granite — saturated living green.', description: 'Below every footpath there is a smaller landscape. Moss & Granite is a focus-stacked macro study from a granite boulder field in the Cairngorms, composited from 42 exposures.\n\nSaturated but not hyperreal — the print leans into the deep greens and wet stone. 200gsm matte archival.', categoryId: catPhoto, tags: ['macro', 'moss', 'green', 'texture'], attributes: { color: 'green', material: 'matte archival paper', orientation: 'landscape' }, base: 3600, featured: false, sizes: POSTER_SIZES },
      { slug: 'salt-flats-ii', name: 'Salt Flats II', summary: 'High-key desert minimalism; near-white with a single line.', description: 'The second of two surviving frames from a series in the Bolivian altiplano. Most of the roll was fogged at the border; Salt Flats II is what remained.\n\nNear-white on white — maddening to proof; quietly satisfying on a wall. 200gsm matte archival paper.', categoryId: catPhoto, tags: ['desert', 'minimal', 'white', 'landscape'], attributes: { color: 'white', material: 'matte archival paper', orientation: 'landscape' }, base: 3400, featured: false, sizes: POSTER_SIZES },
      { slug: 'amber-arc', name: 'Amber Arc', summary: 'Bold abstract arc in amber on warm bone.', description: 'Amber Arc comes from a series of block-print studies in the studio — the arc was cut into lino, proofed twenty-two times, and the fourteenth proof is the one we ship.\n\nWarm, graphic, unfussy. 270gsm cotton-rag stock.', categoryId: catAbstract, tags: ['abstract', 'amber', 'graphic', 'arc'], attributes: { color: 'amber', material: 'cotton-rag stock', orientation: 'portrait' }, base: 3600, featured: false, sizes: POSTER_SIZES },
      { slug: 'peacock-stand', name: 'Peacock Stand', summary: 'Studio portrait of a peacock, ring-lit and unbothered.', description: 'The peacock showed up uninvited at a friend’s studio in Jaipur and stayed for six weeks. Peacock Stand is from the second morning — ring-lit, patient, and entirely on his own terms.\n\nRich greens and inky blues on 200gsm matte archival stock.', categoryId: catPhoto, tags: ['animal', 'peacock', 'colorful', 'studio'], attributes: { color: 'teal', material: 'matte archival paper', orientation: 'portrait' }, base: 4000, featured: false, sizes: POSTER_SIZES },
      { slug: 'coral-bleed', name: 'Coral Bleed', summary: 'Fluid acrylic study — coral pinks bleeding into cream.', description: 'Poured, tilted, and left alone. Coral Bleed is a fluid-acrylic original scanned at 800dpi so every micro-fissure in the paint film survives.\n\nThe color settles somewhere between coral, salmon and rust depending on the light. 200gsm matte archival.', categoryId: catAbstract, tags: ['fluid', 'coral', 'pink', 'abstract'], attributes: { color: 'coral', material: 'matte archival paper', orientation: 'landscape' }, base: 3800, featured: false, sizes: POSTER_SIZES },
      { slug: 'monolith-fjord', name: 'Monolith — Fjord Series', summary: 'Long-exposure fjord study; black basalt, silver water.', description: 'Eight minutes of exposure over a basalt sea stack in north Iceland. The water goes to silk, the rock does not move, and in the darkroom the print took eleven proofs to hold both.\n\n200gsm matte archival paper; silver-black inks.', categoryId: catPhoto, tags: ['fjord', 'dark', 'longexposure', 'monochrome'], attributes: { color: 'black', material: 'matte archival paper', orientation: 'landscape' }, base: 4400, featured: false, sizes: POSTER_SIZES },
      { slug: 'sun-bather', name: 'Sun Bather', summary: 'Retro poolside scene — flat color, hard shadows.', description: 'A love letter to 1970s pool culture in four flat colors. Sun Bather began as a sketch in a Lisbon café and was only finished when the orange was exactly the orange of a Fanta bottle.\n\nGraphically clean at any size. 270gsm cotton-rag stock.', categoryId: catAbstract, tags: ['retro', 'pool', 'orange', 'graphic'], attributes: { color: 'orange', material: 'cotton-rag stock', orientation: 'landscape' }, base: 3600, featured: false, sizes: POSTER_SIZES },
      { slug: 'eucalyptus-haze', name: 'Eucalyptus Haze', summary: 'Soft-focus botanical print in blue-grey greens.', description: 'Photographed with a 98-year-old portrait lens wide open — the softness is the lens, not a filter. Eucalyptus Haze sits between photography and painting.\n\nBlue-grey greens, exceptionally gentle in morning light. 200gsm matte archival.', categoryId: catPhoto, tags: ['botanical', 'soft', 'bluegrey', 'eucalyptus'], attributes: { color: 'sage', material: 'matte archival paper', orientation: 'portrait' }, base: 3800, featured: false, sizes: POSTER_SIZES },
      { slug: 'terra-flow', name: 'Terra Flow', summary: 'Layered terracotta shapes — modern abstract warmth.', description: 'Seven layered shades of terracotta, cut and arranged by hand before being scanned. Terra Flow is study nine of the adobe series.\n\nWarmth without noise. 270gsm cotton-rag stock.', categoryId: catAbstract, tags: ['terracotta', 'abstract', 'layers', 'warm'], attributes: { color: 'terracotta', material: 'cotton-rag stock', orientation: 'portrait' }, base: 3600, featured: true, sizes: POSTER_SIZES },
      { slug: 'night-bloom', name: 'Night Bloom', summary: 'Dark botanical still life — deep blooms on near-black.', description: 'A baroque still life for a dark room — Night Bloom was lit with a single candle-adjacent key light to keep the shadows honest.\n\nViolets and indigo on 270gsm cotton-rag stock; the blacks are layered, not digital.', categoryId: catPhoto, tags: ['floral', 'dark', 'violet', 'stilllife'], attributes: { color: 'violet', material: 'cotton-rag stock', orientation: 'portrait' }, base: 4200, compareAt: 4900, featured: false, sizes: POSTER_SIZES },
      { slug: 'confetti-study', name: 'Confetti Study', summary: 'Playful scattered shapes — bright, optimistic abstraction.', description: 'Cut paper, scattered nine times, photographed from above until the arrangement stopped trying. Confetti Study is the sixth scatter.\n\nBright primary-adjacent pops on warm bone — a children’s room, or the adult who refuses to grow up. 200gsm matte archival.', categoryId: catAbstract, tags: ['playful', 'colorful', 'confetti', 'shapes'], attributes: { color: 'multi', material: 'matte archival paper', orientation: 'portrait' }, base: 3400, featured: false, sizes: POSTER_SIZES },
    ]

    const productIdBySlug = new Map<string, string>()
    const variantIdBySku = new Map<string, string>()

    for (const p of posters) {
      const id = newId()
      productIdBySlug.set(p.slug, id)
      insertProduct.run(
        id, p.slug, p.name, p.summary, p.description, p.categoryId, 'POSTER', 'PUBLISHED',
        p.base, p.compareAt ?? null, JSON.stringify(p.tags), JSON.stringify(p.attributes), p.featured ? 1 : 0,
        p.name, p.summary,
      )
      insertImage.run(newId(), id, posterImage(p.slug), `${p.name} — art print`, 0)
      insertImage.run(newId(), id, posterImage(`${p.slug}-detail`), `${p.name} — texture detail`, 1)
      for (const s of p.sizes) {
        const sku = `${p.slug.toUpperCase().replaceAll('-', '_').slice(0, 18)}_${s.size.toUpperCase()}`
        const vid = newId()
        insertVariant.run(vid, id, sku, s.name, JSON.stringify({ size: s.size, dimensions: s.name.split('·')[1]?.trim() ?? s.size }), s.delta, s.stock)
        variantIdBySku.set(sku, vid)
      }
    }

    // ── Custom upload product (the configurator’s base) ───────────────────
    const customId = newId()
    insertProduct.run(
      customId, 'custom-upload-print', 'Custom Photo Print',
      'Your photograph, printed with care and shipped ready to hang.',
      'Upload any photograph and we print it on 200gsm matte archival stock with pigment inks. Cropping and framing are handled in the studio configurator — choose your print size, add a made-to-measure frame, and check the preview before you order.\n\nPrints are inspected by hand before they ship.',
      catFrames, 'POSTER', 'PUBLISHED', 2999, null,
      JSON.stringify(['custom', 'upload', 'photo']), JSON.stringify({ material: 'matte archival paper' }), 1,
      'Custom Photo Print', 'Upload, size and frame your own photograph — custom printed and shipped in 3-5 days.',
    )
    insertImage.run(newId(), customId, posterImage('custom-upload-print'), 'Custom photo print mockup', 0)
    const CUSTOM_SIZES = [
      { name: 'A4 · 21×30 cm', size: '21x30', delta: 0, stock: 200 },
      { name: 'A3 · 30×40 cm', size: '30x40', delta: 1500, stock: 200 },
      { name: 'A2 · 40×50 cm', size: '40x50', delta: 3000, stock: 200 },
      { name: '50×70 cm', size: '50x70', delta: 4800, stock: 200 },
    ]
    for (const s of CUSTOM_SIZES) {
      const vid = newId()
      insertVariant.run(vid, customId, `CUSTOM_${s.size.toUpperCase()}`, s.name, JSON.stringify({ size: s.size, dimensions: s.name.split('·')[1]?.trim() ?? s.size }), s.delta, s.stock)
      variantIdBySku.set(`CUSTOM_${s.size.toUpperCase()}`, vid)
    }

    // ── Frames (single “made to measure” variant per frame) ───────────────
    type FrameSeed = { slug: string; name: string; summary: string; color: string; material: string; base: number; featured: boolean }
    const frames: FrameSeed[] = [
      { slug: 'oak-frame', name: 'Solid Oak', summary: 'Pale solid oak, hand-oiled. 20mm profile.', color: 'natural oak', material: 'solid oak', base: 2900, featured: true },
      { slug: 'black-aluminum-frame', name: 'Black Aluminum', summary: 'Powder-coated aluminum, 9mm slim profile.', color: 'matte black', material: 'aluminum', base: 2400, featured: true },
      { slug: 'walnut-frame', name: 'Dark Walnut', summary: 'American walnut, satin lacquer. 22mm profile.', color: 'walnut', material: 'solid walnut', base: 3600, featured: false },
      { slug: 'white-aluminum-frame', name: 'White Aluminum', summary: 'Slim white powder-coated aluminum, 9mm.', color: 'white', material: 'aluminum', base: 2400, featured: false },
      { slug: 'gilt-frame', name: 'Gilded Slim', summary: 'Hand-gilded bamboo leaf on wood, slim 12mm.', color: 'gold', material: 'gilded wood', base: 4200, featured: false },
    ]
    for (const f of frames) {
      const id = newId()
      productIdBySlug.set(f.slug, id)
      insertProduct.run(
        id, f.slug, f.name, f.summary,
        `Frames are cut and joined to order in our workshop from ${f.material}. Each frame includes acid-free backing, shatter-resistant glazing and hanging hardware.\n\nOrder alone, or add to a print in the custom studio.`,
        catFrames, 'FRAME', 'PUBLISHED', f.base, null,
        JSON.stringify(['frame', f.color, f.material]), JSON.stringify({ color: f.color, material: f.material }), f.featured ? 1 : 0,
        f.name, f.summary,
      )
      insertImage.run(newId(), id, frameImage(f.slug), `${f.name} — corner detail`, 0)
      const vid = newId()
      insertVariant.run(vid, id, `FRAME_${f.slug.toUpperCase().replaceAll('-', '_')}`, 'Made to measure', JSON.stringify({ type: 'frame' }), 0, 60)
      variantIdBySku.set(`FRAME_${f.slug.toUpperCase().replaceAll('-', '_')}`, vid)
    }

    // ── Coupons ───────────────────────────────────────────────────────────
    const insertCoupon = db.prepare(
      `INSERT INTO coupons (id, code, type, value, min_subtotal_cents, starts_at, ends_at, max_redemptions, per_user_limit, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const welcomeId = newId()
    insertCoupon.run(welcomeId, 'WELCOME10', 'PERCENT', 10, 0, null, null, null, 1, 1)

    // ── Orders (past 14 days, for the admin dashboard) ────────────────────
    const insertOrder = db.prepare(
      `INSERT INTO orders (id, number, user_id, guest_email, status, payment_status, fulfillment_status,
         currency, subtotal_cents, discount_cents, tax_cents, shipping_cents, total_cents, coupon_id,
         shipping_address, shipping_method, tracking_number, carrier, idempotency_key, placed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, 'STANDARD', ?, ?, ?, ?)`,
    )
    const insertOrderItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, variant_id, name, sku, options, preview_url, quantity, unit_price_cents, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertRedemption = db.prepare(
      `INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id) VALUES (?, ?, ?, ?)`,
    )

    const address = JSON.stringify({ firstName: 'Maya', lastName: 'Lindström', line1: '12 Strandvägen', line2: 'Apt 4', city: 'Stockholm', state: '', postalCode: '114 56', country: 'SE' })
    const guestAddress = JSON.stringify({ firstName: 'Jonas', lastName: 'Weber', line1: '8 Lebacher Straße', city: 'Munich', postalCode: '80689', country: 'DE' })

    // (orderNumber, dayOffset, paid, shipped/delivered, items: [slug,sizeIndex,qty], coupon?)
    type SeedItem = [slug: string, sizeIndex: number, qty: number]
    const orders: Array<{
      n: string; d: number; user: string | null; email: string | null; addr: string
      pay: 'PENDING' | 'PAID' | 'FAILED'; fulfill: 'UNFULFILLED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED'
      status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'; items: SeedItem[]; coupon?: boolean; tracking?: string
    }> = [
      { n: 'PRT-100901', d: 13, user: customerId, email: null, addr: address, pay: 'PAID', fulfill: 'DELIVERED', status: 'CONFIRMED', items: [['golden-hour-dunes', 2, 1], ['grid-city-night', 0, 1]], tracking: '1Z99XRT2211', coupon: true },
      { n: 'PRT-100915', d: 11, user: customerId, email: null, addr: address, pay: 'PAID', fulfill: 'SHIPPED', status: 'CONFIRMED', items: [['tide-lines-no-2', 4, 1]], tracking: '1Z99XRT2212' },
      { n: 'PRT-100928', d: 8, user: null, email: 'guest2@printique.test', addr: guestAddress, pay: 'PAID', fulfill: 'SHIPPED', status: 'CONFIRMED', items: [['fern-atrium', 1, 1], ['amber-arc', 1, 1]], tracking: '1Z99XRT2213' },
      { n: 'PRT-100942', d: 6, user: customerId, email: null, addr: address, pay: 'PAID', fulfill: 'PROCESSING', status: 'CONFIRMED', items: [['moss-granite', 2, 2]] },
      { n: 'PRT-100958', d: 3, user: null, email: 'sara.k@example.com', addr: guestAddress, pay: 'PAID', fulfill: 'UNFULFILLED', status: 'CONFIRMED', items: [['night-bloom', 3, 1]], coupon: true },
      { n: 'PRT-100971', d: 1, user: customer2Id, email: null, addr: guestAddress, pay: 'PENDING', fulfill: 'UNFULFILLED', status: 'PENDING', items: [['custom-upload-print', 2, 1]] },
    ]

    let orderNum = 100972
    for (const o of orders) {
      const oid = newId()
      const sizeKinds = POSTER_SIZES
      let subtotal = 0
      for (const [slug, sizeIndex, qty] of o.items) {
        const poster = slug === 'custom-upload-print' ? null : posters.find((p) => p.slug === slug)
        const base = slug === 'custom-upload-print' ? 2999 : poster!.base
        const size = (slug === 'custom-upload-print' ? CUSTOM_SIZES : sizeKinds)[sizeIndex]!
        const unitPrice = base + size.delta
        subtotal += unitPrice * qty
      }
      const discount = o.coupon ? Math.round(subtotal * 0.1) : 0
      const shipping = subtotal - discount >= 10000 ? 0 : 790
      const taxable = subtotal - discount + shipping
      const tax = Math.round(taxable * 0.08)
      const total = taxable + tax
      insertOrder.run(
        oid, o.n, o.user, o.email, o.status, o.pay, o.fulfill,
        subtotal, discount, tax, shipping, total, o.coupon ? welcomeId : null,
        o.addr, o.tracking ?? null, o.tracking ? 'UPS' : null, `seed-${o.n}`, daysAgo(o.d),
      )
      for (const [slug, sizeIndex, qty] of o.items) {
        const poster = slug === 'custom-upload-print'
          ? { name: 'Custom Photo Print' }
          : posters.find((p) => p.slug === slug)!
        const base = slug === 'custom-upload-print' ? 2999 : (poster as (typeof posters)[number]).base
        const size = (slug === 'custom-upload-print' ? CUSTOM_SIZES : POSTER_SIZES)[sizeIndex]!
        const unit = base + size.delta
        const skuPrefix = slug === 'custom-upload-print' ? 'CUSTOM_' : `${slug.toUpperCase().replaceAll('-', '_').slice(0, 18)}_`
        const sku = `${skuPrefix}${size.size.toUpperCase()}`
        insertOrderItem.run(
          newId(), oid, productIdBySlug.get(slug) ?? null, variantIdBySku.get(sku) ?? null,
          slug === 'custom-upload-print' ? 'Custom Photo Print' : (poster as (typeof posters)[number]).name,
          sku, JSON.stringify({ size: size.size }), posterImage(slug), qty, unit, unit * qty,
        )
      }
      if (o.coupon) insertRedemption.run(newId(), welcomeId, o.user, oid)
    }

    // ── Reviews ───────────────────────────────────────────────────────────
    const insertReview = db.prepare(
      `INSERT INTO reviews (id, product_id, user_id, rating, title, body, status, verified_purchase, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const seededReviews: Array<[slug: string, user: string, rating: number, title: string, body: string, status: 'APPROVED' | 'PENDING', days: number]> = [
      ['golden-hour-dunes', customerId, 5, 'Better than the photos', 'The matte stock takes the warmth really well — no glare at all in the afternoon. Arrived flat in a sturdy tube, framed it same evening.', 'APPROVED', 9],
      ['tide-lines-no-2', customerId, 5, 'Calming, exactly what I wanted', 'The aerial texture reads as almost abstract from across the room, and becomes photographic up close. Print quality is excellent.', 'APPROVED', 7],
      ['fern-atrium', customer2Id, 4, 'Lovely, greener than expected', 'Slightly more saturated green than on my screen, in a good way. B+ on packaging (corner of the tube was dented, print fine).', 'APPROVED', 12],
      ['grid-city-night', customer2Id, 5, 'Midnight blues, real depth', 'The layered inks genuinely do shift toward violet under warm lamps. Framing service was worth it.', 'APPROVED', 4],
      ['night-bloom', customer2Id, 5, 'Ordered my second', 'Put the first one in the hallway, ordered another for the study. The darks are layered like a proper lithograph.', 'PENDING', 2],
    ]
    for (const [slug, user, rating, title, body, status, days] of seededReviews) {
      insertReview.run(newId(), productIdBySlug.get(slug)!, user, rating, title, body, status, 1, daysAgo(days))
    }
    // Ratings are computed live from approved reviews (no denormalized column).

    // ── Sample wishlist + notification + upload ───────────────────────────
    const insertWish = db.prepare(`INSERT INTO wishlist_items (id, user_id, product_id, created_at) VALUES (?, ?, ?, ?)`)
    insertWish.run(newId(), customerId, productIdBySlug.get('salt-flats-ii')!, daysAgo(5))
    insertWish.run(newId(), customerId, productIdBySlug.get('oak-frame')!, daysAgo(5))

    db.prepare(`INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)`).run(
      newId(), customerId, 'ORDER_SHIPPED', 'Your order PRT-100915 has shipped',
      'UPS tracking 1Z99XRT2212 — expected within 3–4 business days.',
      JSON.stringify({ order: 'PRT-100915' }),
    )

    const uploadKey = `seed/${newToken(16)}.jpg`
    db.prepare(
      `INSERT INTO uploads (id, owner_user_id, storage_key, mime, size_bytes, width, height, original_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), customerId, uploadKey, 'image/jpeg', 2_400_000, 4032, 3024, 'stockholm-harbor.jpg', daysAgo(3))

    // ── Audit trail marker ────────────────────────────────────────────────
    db.prepare(`INSERT INTO audit_log (id, actor_id, action, entity, entity_id, meta) VALUES (?, ?, ?, ?, ?, ?)`).run(
      newId(), adminId, 'DEV_SEED', 'database', 'db', JSON.stringify({ version: 1 }),
    )

    db.prepare(`INSERT INTO settings (key, value) VALUES ('seeded_version', '1')`).run()
  })

  const counts = {
    products: (db.prepare(`SELECT COUNT(*) n FROM products`).get() as { n: number }).n,
    variants: (db.prepare(`SELECT COUNT(*) n FROM product_variants`).get() as { n: number }).n,
    orders: (db.prepare(`SELECT COUNT(*) n FROM orders`).get() as { n: number }).n,
    users: (db.prepare(`SELECT COUNT(*) n FROM users`).get() as { n: number }).n,
  }
  console.log(`✓ Seeded: ${counts.products} products (${counts.variants} variants), ${counts.orders} orders, ${counts.users} users`)
  console.log('  Admin sign-in    → admin@printique.test / Printique!2026')
  console.log('  Customer sign-in → demo@printique.test  / Printique!2026')
}

  void main()
