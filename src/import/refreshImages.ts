import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { slugify } from '../fields/slug'

/**
 * Replaces placeholder artwork with real photography from Edamam.
 *
 * The dev seed generates gradient placeholders (credit starts with
 * "PLACEHOLDER") for its recipes and cuisine hubs. This sweep finds every
 * hero still wearing one, searches Edamam for the dish (or cuisine) by name,
 * and swaps in the best photograph — credited as illustrative, since it
 * shows the dish from another publisher, not our own plate.
 *
 * Idempotent: photos land in the media library under the same alt convention
 * the hybrid importer uses (`<title> — imported`), so neither pipeline ever
 * fetches the same photo twice. Run with `npm run images:refresh`.
 *
 * ⚠️  Re-running `npm run seed` resets seed recipes' heroes back to
 *     placeholders — just run this again afterwards.
 */

const EDAMAM_API = 'https://api.edamam.com/api/recipes/v2'

const appId = process.env.EDAMAM_APP_ID
const appKey = process.env.EDAMAM_APP_KEY
if (!appId || !appKey) {
  console.error('EDAMAM_APP_ID / EDAMAM_APP_KEY are not set — nothing to fetch photos with.')
  process.exit(1)
}

const payload = await getPayload({ config })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type EdamamImages = {
  images?: { LARGE?: { url?: string }; REGULAR?: { url?: string } }
  image?: string
}

/**
 * Best photo Edamam can serve. LARGE (600×600) is its ceiling, so we filter
 * for recipes that have it and only fall back to REGULAR (300×300) when no
 * LARGE-bearing hit exists for the query.
 */
/** Seconds between Edamam calls — the free plan is 1 hit per MINUTE. */
const EDAMAM_INTERVAL_MS =
  Math.ceil(60_000 / Math.max(1, Math.min(10, Number.parseInt(process.env.EDAMAM_CALLS_PER_MIN ?? '1', 10) || 1))) +
  1_000

async function findEdamamImage(query: string, size: 'LARGE' | 'REGULAR' = 'LARGE'): Promise<string | null> {
  await sleep(EDAMAM_INTERVAL_MS)
  const params = new URLSearchParams({
    type: 'public',
    app_id: appId!,
    app_key: appKey!,
    q: query,
    imageSize: size,
  })
  const res = await fetch(`${EDAMAM_API}?${params}`, {
    headers: process.env.EDAMAM_ACCOUNT_USER
      ? { 'Edamam-Account-User': process.env.EDAMAM_ACCOUNT_USER }
      : undefined,
  })
  if (res.status === 429) {
    console.warn('  rate limited — waiting 65s…')
    await sleep(65_000)
    return findEdamamImage(query, size)
  }
  if (!res.ok) {
    console.warn(`  Edamam ${res.status} for “${query}”`)
    return null
  }
  const data = (await res.json()) as { hits?: Array<{ recipe?: EdamamImages }> }
  const hit = data.hits?.[0]?.recipe
  const url = hit?.images?.LARGE?.url ?? hit?.images?.REGULAR?.url ?? hit?.image ?? null
  if (!url && size === 'LARGE') return findEdamamImage(query, 'REGULAR')
  return url
}

/** Download into the media library, reusing any photo already fetched. */
async function upsertPhoto(title: string, query: string): Promise<number | null> {
  const alt = `${title} — imported`
  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: alt } },
    limit: 1,
  })
  if (existing.docs[0]) return existing.docs[0].id

  const url = await findEdamamImage(query)
  if (!url) return null

  const res = await fetch(url)
  if (!res.ok) return null
  const data = Buffer.from(await res.arrayBuffer())
  // Edamam's S3 sometimes says binary/octet-stream — Payload rejects
  // non-image mimetypes, so trust the header only when it's an image type.
  const header = res.headers.get('content-type')?.split(';')[0] ?? ''
  const mimetype = header.startsWith('image/') ? header : 'image/jpeg'

  const doc = await payload.create({
    collection: 'media',
    data: {
      alt,
      credit: 'Illustrative photo of the dish, via Edamam.',
      license: 'licensed',
    },
    file: {
      data,
      mimetype,
      name: `${slugify(title)}-import.jpg`,
      size: data.byteLength,
    },
  })
  return doc.id
}

function isPlaceholder(hero: unknown): boolean {
  return (
    typeof hero === 'object' &&
    hero !== null &&
    'credit' in hero &&
    typeof (hero as { credit?: string }).credit === 'string' &&
    (hero as { credit: string }).credit.startsWith('PLACEHOLDER')
  )
}

let swapped = 0
let missed = 0

// --- Recipes ----------------------------------------------------------------
const recipes = await payload.find({ collection: 'recipes', depth: 1, limit: 1000 })
for (const recipe of recipes.docs) {
  if (!isPlaceholder(recipe.heroImage)) continue
  try {
    const photo = await upsertPhoto(recipe.title, recipe.title)
    if (photo) {
      await payload.update({ collection: 'recipes', id: recipe.id, data: { heroImage: photo } })
      swapped++
      console.log(`✓ ${recipe.title}`)
    } else {
      missed++
      console.warn(`✗ ${recipe.title} — no photo found, placeholder kept`)
    }
  } catch (error) {
    missed++
    console.warn(`✗ ${recipe.title}: ${error instanceof Error ? error.message : error}`)
  }
}

// --- Cuisine hubs -----------------------------------------------------------
const cuisines = await payload.find({ collection: 'cuisines', depth: 1, limit: 100 })
for (const cuisine of cuisines.docs) {
  // A hub needs a photo when it has a placeholder OR nothing at all (the
  // ghost-media cleanup unlinked heroes whose files had vanished).
  if (cuisine.heroImage && !isPlaceholder(cuisine.heroImage)) continue
  try {
    const photo = await upsertPhoto(`${cuisine.name} cuisine`, `${cuisine.name} food`)
    if (photo) {
      await payload.update({ collection: 'cuisines', id: cuisine.id, data: { heroImage: photo } })
      swapped++
      console.log(`✓ ${cuisine.name} (hub)`)
    } else {
      missed++
      console.warn(`✗ ${cuisine.name} (hub) — no photo found, placeholder kept`)
    }
  } catch (error) {
    missed++
    console.warn(`✗ ${cuisine.name} (hub): ${error instanceof Error ? error.message : error}`)
  }
}

console.log(`\nDone — ${swapped} heroes photographed, ${missed} not found.`)
process.exit(0)
