import 'dotenv/config'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { upscaler } from 'upscayl-node'

/**
 * AI-upscales every small photo in the media library (`npm run images:upscale`).
 *
 * Sized by USAGE, not by maximum: the largest surface any photo reaches is
 * the 1600px-wide recipe-page hero (which sits behind a dark scrim); cards
 * render at ≤800px, thumbnails at 480. So Real-ESRGAN targets 1600px wide —
 * enough for every surface at retina density, without the painterly
 * artifacts aggressive 4× blowups introduce. The photo APIs top out around
 * 600px, so this is roughly a 2.7× lift. Payload then regenerates the
 * responsive sizes (thumbnail/card/hero/og) as true downscales.
 *
 * Idempotent: once a photo's width crosses the threshold it is never touched
 * again. Placeholder gradients are skipped — enlarging a gradient is noise.
 *
 * Env knobs: UPSCALE_MAX_WIDTH (default 1200 — smaller gets upscaled),
 * UPSCALE_TARGET_WIDTH (default 1600), UPSCALE_LIMIT (cap per run).
 */

const MAX_WIDTH = Number.parseInt(process.env.UPSCALE_MAX_WIDTH ?? '1200', 10)
const TARGET_WIDTH = Number.parseInt(process.env.UPSCALE_TARGET_WIDTH ?? '1600', 10)
const LIMIT = Number.parseInt(process.env.UPSCALE_LIMIT ?? '10000', 10)
const MEDIA_DIR = path.resolve('media')

const payload = await getPayload({ config })

// Only media the site actually shows — retired importers left orphans behind.
const usedIds = new Set<number>()
const collect = (ref: unknown) => {
  const id = typeof ref === 'object' && ref !== null ? (ref as { id?: number }).id : ref
  if (typeof id === 'number') usedIds.add(id)
}
const [allRecipes, allCuisines, allBrandCards] = await Promise.all([
  payload.find({ collection: 'recipes', depth: 0, limit: 2000, select: { heroImage: true, ogImage: true } }),
  payload.find({ collection: 'cuisines', depth: 0, limit: 100, select: { heroImage: true } }),
  payload.find({ collection: 'brandCards', depth: 0, limit: 200, select: { logo: true, productImage: true } }),
])
for (const r of allRecipes.docs) {
  collect(r.heroImage)
  collect(r.ogImage)
}
for (const c of allCuisines.docs) collect(c.heroImage)
for (const b of allBrandCards.docs) {
  collect(b.logo)
  collect(b.productImage)
}

const found = await payload.find({
  collection: 'media',
  where: {
    and: [
      { width: { less_than: MAX_WIDTH } },
      { mimeType: { like: 'image/' } },
      { credit: { not_like: 'PLACEHOLDER' } },
    ],
  },
  limit: 10_000,
  sort: 'createdAt',
})
const candidates = { docs: found.docs.filter((d) => usedIds.has(d.id)).slice(0, LIMIT) }

if (candidates.docs.length === 0) {
  console.log(`Nothing to do — no non-placeholder images under ${MAX_WIDTH}px wide.`)
  process.exit(0)
}

console.log(
  `Upscaling ${candidates.docs.length} images (width < ${MAX_WIDTH}px) to ${TARGET_WIDTH}px wide…`,
)

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palate-upscale-'))
let done = 0
let failed = 0
let consecutiveFailures = 0

for (const doc of candidates.docs) {
  if (!doc.filename || doc.mimeType === 'image/svg+xml') continue
  const input = path.join(MEDIA_DIR, doc.filename)
  if (!fs.existsSync(input)) {
    console.warn(`✗ ${doc.filename} — file missing on disk`)
    failed++
    continue
  }

  try {
    const output = path.join(tmpDir, `${path.parse(doc.filename).name}-up.png`)
    await upscaler.upscaleImage(input, output, { customWidth: TARGET_WIDTH })

    const data = fs.readFileSync(output)
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: {},
      file: {
        data,
        mimetype: 'image/png',
        name: `${path.parse(doc.filename).name}-up.png`,
        size: data.byteLength,
      },
    })
    fs.rmSync(output, { force: true })
    done++
    consecutiveFailures = 0
    console.log(`✓ ${doc.alt ?? doc.filename} — ${doc.width}px → ${TARGET_WIDTH}px`)
  } catch (error) {
    failed++
    consecutiveFailures++
    console.warn(`✗ ${doc.filename}: ${error instanceof Error ? error.message : error}`)
    // Real-ESRGAN needs a working Vulkan device. Three straight failures with
    // zero successes means the GPU isn't reachable (typically an NVIDIA
    // driver/library mismatch after an update) — bail with the fix instead
    // of grinding through the whole library.
    if (consecutiveFailures >= 3 && done === 0) {
      console.error('\nAborting: the upscaler cannot reach a GPU (Vulkan init failed).')
      console.error('Usual cause: NVIDIA driver updated but the old kernel module is loaded — reboot, then re-run:')
      console.error('  npm run images:upscale')
      process.exit(1)
    }
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true })
console.log(`\nDone — ${done} upscaled, ${failed} failed.`)
process.exit(0)
