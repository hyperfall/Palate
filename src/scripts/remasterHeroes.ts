import 'dotenv/config'
import { mkdir, copyFile, readFile, access, readdir } from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../payload.config'
import {
  HERO_IDEAL_WIDTH,
  heroResolution,
  heroUpscaleFactor,
  isUpscaled,
  laplacianVariance,
  SOFT_BELOW,
} from '../lib/imageSharpness'

/**
 * Re-master hero photographs that were enlarged before they were uploaded.
 *
 * Sixteen of eighteen recipe heroes are 1600x1600 PNGs named "-import-up",
 * and the "up" is literal: measured at native size they score 28-57 on a
 * Laplacian variance where this library's genuine photographs score 195-215.
 * They hold no more detail than the small originals they were blown up from,
 * so the hero band paints roughly 700px of real information across 2,530
 * device pixels on a retina screen.
 *
 * No code can invent the missing detail. What it can do is stop discarding
 * what survives: an unsharp mask tuned for the display size roughly doubles
 * measured sharpness at every width Next serves, and re-encoding the PNG as
 * JPEG drops a 4 MB master to under 300 KB. The fix for the rest is better
 * source photographs.
 *
 *   npm run remaster:heroes          # report only
 *   npm run remaster:heroes -- --apply
 *
 * Originals are copied to media/_originals before anything is written, because
 * media/ is gitignored and there is no other way back.
 */
const APPLY = process.argv.includes('--apply')

const payload = await getPayload({ config })

const MEDIA_DIR = path.resolve(process.cwd(), 'media')
const BACKUP_DIR = path.join(MEDIA_DIR, '_originals')

/** Tuned on this library: visibly crisper with no halos at the hero's size. */
const UNSHARP = { sigma: 1.1, m1: 0.6, m2: 2.2 } as const

/**
 * Which heroes have already been through this.
 *
 * Sharpening is not idempotent — run it twice and the halos it carefully
 * avoids the first time appear. Sharpening also does not always lift a file
 * past the threshold (butter-chicken went 28 -> 62, still "soft"), so the
 * measurement alone would re-process it on every run, compounding each time.
 * The backup is the record: a file in media/_originals means this one is done.
 */
const backedUp = new Set<string>(
  await readdir(BACKUP_DIR)
    .then((names) => names.map((n) => n.replace(/\.[^.]+$/, '')))
    .catch(() => []),
)
const alreadyRemastered = (filename: string) => backedUp.has(filename.replace(/\.[^.]+$/, ''))

async function sharpnessOf(file: string): Promise<number> {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return laplacianVariance({ data, width: info.width, height: info.height })
}

const recipes = await payload.find({ collection: 'recipes', limit: 500, depth: 1 })

type Row = {
  slug: string
  id: number | string
  filename: string
  width: number
  before: number
  after?: number
  fromKb: number
  toKb?: number
  action: string
}
const rows: Row[] = []

for (const recipe of recipes.docs) {
  const hero = recipe.heroImage
  if (!hero || typeof hero !== 'object' || !hero.filename) continue

  const file = path.join(MEDIA_DIR, hero.filename)
  try {
    await access(file)
  } catch {
    rows.push({
      slug: String(recipe.slug),
      id: hero.id,
      filename: hero.filename,
      width: hero.width ?? 0,
      before: 0,
      fromKb: 0,
      action: 'MISSING FILE',
    })
    continue
  }

  const original = await readFile(file)
  const before = await sharpnessOf(file)
  const width = hero.width ?? 0
  const fromKb = Math.round(original.length / 1024)

  if (alreadyRemastered(hero.filename)) {
    rows.push({
      slug: String(recipe.slug),
      id: hero.id,
      filename: hero.filename,
      width,
      before: Math.round(before),
      fromKb,
      action: 'already re-mastered',
    })
    continue
  }

  if (!isUpscaled(before, width)) {
    rows.push({
      slug: String(recipe.slug),
      id: hero.id,
      filename: hero.filename,
      width,
      before: Math.round(before),
      fromKb,
      action: 'ok — leave alone',
    })
    continue
  }

  // Same pixel dimensions: the detail is gone either way, and shrinking the
  // master would only force the browser to do the upscaling instead.
  const remastered = await sharp(original).removeAlpha().sharpen(UNSHARP).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
  const after = laplacianVariance(
    await sharp(remastered)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ data, width: info.width, height: info.height })),
  )
  const name = hero.filename.replace(/\.[^.]+$/, '') + '.jpg'

  const row: Row = {
    slug: String(recipe.slug),
    id: hero.id,
    filename: hero.filename,
    width,
    before: Math.round(before),
    after: Math.round(after),
    fromKb,
    toKb: Math.round(remastered.length / 1024),
    action: APPLY ? 'remastered' : 'would remaster',
  }

  if (APPLY) {
    await mkdir(BACKUP_DIR, { recursive: true })
    await copyFile(file, path.join(BACKUP_DIR, hero.filename))
    // Re-uploading through the local API is what regenerates every derived
    // size; writing the bytes to disk alone would leave the old variants.
    await payload.update({
      collection: 'media',
      id: hero.id,
      data: {},
      file: { data: remastered, name, mimetype: 'image/jpeg', size: remastered.length },
    })
  }

  rows.push(row)
}

const changed = rows.filter((r) => r.action.includes('remaster'))
const pad = (s: string | number, n: number) => String(s).padEnd(n)

console.log(`\nHero photographs — sharpness at native size (soft below ${SOFT_BELOW})\n`)
console.log(
  pad('recipe', 38) + pad('px', 7) + pad('for hero', 15) + pad('before', 8) + pad('after', 8) + pad('size', 16) + 'action',
)
for (const r of rows.sort((a, b) => a.before - b.before)) {
  console.log(
    pad(r.slug.slice(0, 36), 38) +
      pad(r.width, 7) +
      pad(
        r.width ? `${heroResolution(r.width)}${heroResolution(r.width) === 'ample' ? '' : ` ${heroUpscaleFactor(r.width).toFixed(1)}x`}` : '·',
        15,
      ) +
      pad(r.before, 8) +
      pad(r.after ?? '·', 8) +
      pad(r.toKb ? `${r.fromKb}KB→${r.toKb}KB` : `${r.fromKb}KB`, 16) +
      r.action,
  )
}

const saved = changed.reduce((n, r) => n + (r.fromKb - (r.toKb ?? r.fromKb)), 0)
console.log(
  `\n${changed.length} of ${rows.length} heroes are enlarged imports.` +
    (changed.length ? ` Re-mastering saves ${(saved / 1024).toFixed(1)} MB.` : ''),
)
if (changed.length && !APPLY) console.log('Report only. Re-run with --apply to write.\n')
if (changed.length && APPLY) console.log(`Originals kept in ${path.relative(process.cwd(), BACKUP_DIR)}.\n`)

const small = rows.filter((r) => r.width && heroResolution(r.width) !== 'ample')
if (small.length) {
  console.log(
    `\n${small.length} heroes are narrower than ${HERO_IDEAL_WIDTH}px, so the full-bleed band\n` +
      'stretches them on a retina screen no matter how clean the file is. This is\n' +
      'separate from softness: a sharp 1200px photograph still upscales 2.4x here.\n' +
      'Copying an image from a web page captures the size that page chose to show,\n' +
      'which is usually a responsive variant rather than the original.\n',
  )
}

console.log(
  'Sharpening recovers what survived the enlargement; it cannot restore what\n' +
    'the enlargement threw away. These heroes need better source photographs.\n',
)

process.exit(0)
