import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'

import { mapRecipe, type SpoonacularRecipe } from './spoonacular'
import { slugify } from '../fields/slug'

/**
 * The hybrid import pipeline. Spoonacular is the CONTENT source — real
 * instructions, structured ingredients, times, nutrition, price per serving.
 * Edamam is the PHOTO source: for each dish we search its title and take the
 * best food photograph, falling back to Spoonacular's own image when Edamam
 * has no match. Edamam photos come from other publishers of the same dish,
 * so they're credited as illustrative.
 *
 * Needs SPOONACULAR_API_KEY (content) and EDAMAM_APP_ID/EDAMAM_APP_KEY
 * (photos) in .env. If Edamam creds are missing or rejected, the run
 * continues on Spoonacular images alone. The first run purges anything the
 * retired single-source pipelines imported. Idempotent: recipes match on
 * slug, media on alt — re-runs only call Edamam for recipes whose photo
 * isn't already in the library.
 *
 * Budgets: Spoonacular free tier 150 points/day (a sweep costs 40–70).
 * Edamam free tier 10 calls/min — new-photo lookups are paced at 6.1s, so
 * the FIRST full sweep takes ~25 minutes; later sweeps skip cached photos.
 */

const SPOONACULAR_API = 'https://api.spoonacular.com'
const EDAMAM_API = 'https://api.edamam.com/api/recipes/v2'
const PER_CUISINE = clampInt(process.env.SPOONACULAR_PER_CUISINE, 1, 50) ?? 10

type CuisineTarget = {
  api: string
  name: string
  slug: string
  region: string
  flagEmoji?: string
  description?: string
}

const CUISINES: CuisineTarget[] = [
  { api: 'African', name: 'African', slug: 'african', region: 'africa', flagEmoji: '🌍', description: 'Jollof, tagines, berbere, suya — a continent of technique the recipe internet keeps underestimating.' },
  { api: 'American', name: 'American', slug: 'american', region: 'north-america', flagEmoji: '🇺🇸', description: 'Diner classics, backyard smoke, and the immigrant kitchens that built all of it.' },
  { api: 'Asian', name: 'Pan-Asian', slug: 'pan-asian', region: 'cross-regional', flagEmoji: '🌏', description: 'Dishes that travel the continent — where wok, broth, and rice meet.' },
  { api: 'British', name: 'British', slug: 'british', region: 'northern-europe', flagEmoji: '🇬🇧', description: 'Pies, roasts, and puddings — comfort engineering from a damp island.' },
  { api: 'Cajun', name: 'Cajun & Creole', slug: 'cajun', region: 'north-america', flagEmoji: '⚜️', description: 'Louisiana’s holy trinity, dark roux, and heat that builds rather than shouts.' },
  { api: 'Caribbean', name: 'Caribbean', slug: 'caribbean', region: 'caribbean', flagEmoji: '🏝️', description: 'Jerk, scotch bonnet, allspice, and slow fire — island cooking with real reach.' },
  { api: 'Chinese', name: 'Chinese', slug: 'chinese', region: 'east-asia' },
  { api: 'Eastern European', name: 'Eastern European', slug: 'eastern-european', region: 'eastern-europe', description: 'Dumplings, ferments, paprika, and dill — cold-climate cooking that wastes nothing.' },
  { api: 'European', name: 'Pan-European', slug: 'pan-european', region: 'cross-regional', flagEmoji: '🇪🇺', description: 'The continental repertoire — dishes that crossed borders until everyone claimed them.' },
  { api: 'French', name: 'French', slug: 'french', region: 'southern-europe', flagEmoji: '🇫🇷', description: 'The grammar of Western technique: stocks, sauces, butter, patience.' },
  { api: 'German', name: 'German', slug: 'german', region: 'northern-europe', flagEmoji: '🇩🇪', description: 'Schnitzel, spätzle, and bread culture taken deadly seriously.' },
  { api: 'Greek', name: 'Greek', slug: 'greek', region: 'southern-europe', flagEmoji: '🇬🇷', description: 'Olive oil, lemon, oregano, char — sunshine cooking older than the alphabet.' },
  { api: 'Indian', name: 'Indian', slug: 'indian', region: 'south-asia' },
  { api: 'Irish', name: 'Irish', slug: 'irish', region: 'northern-europe', flagEmoji: '🇮🇪', description: 'Butter, potatoes, brown bread, and stew — restraint that reads as comfort.' },
  { api: 'Italian', name: 'Italian', slug: 'italian', region: 'southern-europe' },
  { api: 'Japanese', name: 'Japanese', slug: 'japanese', region: 'east-asia' },
  { api: 'Jewish', name: 'Jewish', slug: 'jewish', region: 'cross-regional', description: 'Braises, briskets, and breads carried across a diaspora and perfected in transit.' },
  { api: 'Korean', name: 'Korean', slug: 'korean', region: 'east-asia' },
  { api: 'Latin American', name: 'Latin American', slug: 'latin-american', region: 'latin-america', flagEmoji: '🌎', description: 'Maize, chiles, citrus, and grill smoke from the Rio Grande to Patagonia.' },
  { api: 'Mediterranean', name: 'Mediterranean', slug: 'mediterranean', region: 'cross-regional', flagEmoji: '🫒', description: 'The olive-oil belt: vegetables treated like the main event, because they are.' },
  { api: 'Mexican', name: 'Mexican', slug: 'mexican', region: 'latin-america' },
  { api: 'Middle Eastern', name: 'Levantine', slug: 'levantine', region: 'middle-east' },
  { api: 'Nordic', name: 'Nordic', slug: 'nordic', region: 'northern-europe', description: 'Rye, cure, pickle, forage — precision cooking for long winters.' },
  { api: 'Southern', name: 'Southern US', slug: 'southern-us', region: 'north-america', description: 'Low and slow: biscuits, greens, fried chicken, and the art of the Sunday table.' },
  { api: 'Spanish', name: 'Spanish', slug: 'spanish', region: 'southern-europe', flagEmoji: '🇪🇸', description: 'Paella, pimentón, and the tapas logic that dinner is better as a dozen small ones.' },
  { api: 'Thai', name: 'Thai', slug: 'thai', region: 'southeast-asia' },
  { api: 'Vietnamese', name: 'Vietnamese', slug: 'vietnamese', region: 'southeast-asia', flagEmoji: '🇻🇳', description: 'Broth clarity, herb plates, and the fish-sauce backbone — freshness as a discipline.' },
]

function clampInt(raw: string | undefined, min: number, max: number): number | null {
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) ? null : Math.max(min, Math.min(max, n))
}

const spoonacularKey = process.env.SPOONACULAR_API_KEY
if (!spoonacularKey) {
  console.error('SPOONACULAR_API_KEY is not set (content source).')
  console.error('Add it to .env (https://spoonacular.com/food-api/console), then re-run:')
  console.error('  npm run import:recipes')
  process.exit(1)
}

/**
 * Edamam photos are OPT-IN (EDAMAM_PHOTOS=1). The free plan allows 1 hit per
 * MINUTE, which would stretch a first sweep past four hours — and with the
 * 4× upscaler in the pipeline, Spoonacular's own photos (636px → 2544px
 * upscaled, the actual dish, right aspect) are the better default anyway.
 */
const edamamId = process.env.EDAMAM_APP_ID
const edamamKey = process.env.EDAMAM_APP_KEY
let edamamDown = process.env.EDAMAM_PHOTOS !== '1' || !edamamId || !edamamKey
if (edamamDown) {
  console.log('Photos: Spoonacular originals (upscaled after import). Set EDAMAM_PHOTOS=1 to source from Edamam instead.')
}

/** Seconds between Edamam calls — the free plan is 1/min. */
const EDAMAM_INTERVAL_MS =
  Math.ceil(60_000 / (clampInt(process.env.EDAMAM_CALLS_PER_MIN, 1, 10) ?? 1)) + 1_000

/** One real sweep per day; `IMPORT_FORCE=1 npm run import:recipes` overrides. */
const STAMP = path.join('node_modules', '.cache', 'import-stamp.json')
const FRESH_HOURS = 20

if (!process.env.IMPORT_FORCE) {
  try {
    const stamp = JSON.parse(fs.readFileSync(STAMP, 'utf8')) as { at: number }
    const ageHours = (Date.now() - stamp.at) / 3_600_000
    if (ageHours < FRESH_HOURS) {
      console.log(
        `Catalog imported ${Math.round(ageHours)}h ago — skipping the sweep. IMPORT_FORCE=1 to run anyway.`,
      )
      process.exit(0)
    }
  } catch {
    // No stamp yet — proceed.
  }
}

const payload = await getPayload({ config })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class QuotaExhausted extends Error {}

async function spoonacularJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 402) throw new QuotaExhausted('Spoonacular daily quota exhausted (HTTP 402).')
  if (res.status === 401) {
    console.error('Spoonacular rejected the API key (HTTP 401). Check SPOONACULAR_API_KEY in .env.')
    process.exit(1)
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/**
 * The Edamam half: search the dish title, take the best photo. Returns null
 * on no match or any Edamam trouble — the caller falls back to Spoonacular's
 * image. Auth failures switch Edamam off for the rest of the run.
 */
async function findEdamamImage(title: string, size: 'LARGE' | 'REGULAR' = 'LARGE'): Promise<string | null> {
  if (edamamDown) return null
  try {
    // Only new photos reach this call; re-runs are nearly free. LARGE
    // (600×600) is Edamam's ceiling — REGULAR (300×300) is a last resort.
    await sleep(EDAMAM_INTERVAL_MS)
    const params = new URLSearchParams({
      type: 'public',
      app_id: edamamId!,
      app_key: edamamKey!,
      q: title,
      imageSize: size,
    })
    // Some Edamam plans REQUIRE the user-tracking header; others reject it
    // outright ("This app does not support users"). Send it only when
    // EDAMAM_ACCOUNT_USER is explicitly set in .env.
    const res = await fetch(`${EDAMAM_API}?${params}`, {
      headers: process.env.EDAMAM_ACCOUNT_USER
        ? { 'Edamam-Account-User': process.env.EDAMAM_ACCOUNT_USER }
        : undefined,
    })
    if (res.status === 401 || res.status === 403) {
      console.warn(`Edamam rejected the credentials (HTTP ${res.status}) — continuing on Spoonacular images.`)
      edamamDown = true
      return null
    }
    if (res.status === 429) {
      await sleep(65_000)
      return findEdamamImage(title, size)
    }
    if (!res.ok) return null
    const data = (await res.json()) as {
      hits?: Array<{
        recipe?: { images?: { LARGE?: { url?: string }; REGULAR?: { url?: string } }; image?: string }
      }>
    }
    const hit = data.hits?.[0]?.recipe
    const url = hit?.images?.LARGE?.url ?? hit?.images?.REGULAR?.url ?? hit?.image ?? null
    if (!url && size === 'LARGE') return findEdamamImage(title, 'REGULAR')
    return url
  } catch {
    return null
  }
}

async function upsertImage(title: string, spoonacularUrl: string): Promise<number> {
  const alt = `${title} — imported`
  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: alt } },
    limit: 1,
  })
  if (existing.docs[0]) return existing.docs[0].id

  const edamamUrl = await findEdamamImage(title)
  const url = edamamUrl ?? spoonacularUrl
  if (!url) throw new Error('no image available')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`image ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  // S3 hosts sometimes say binary/octet-stream — Payload rejects non-image
  // mimetypes, so trust the header only when it's an image type.
  const header = res.headers.get('content-type')?.split(';')[0] ?? ''
  const mimetype = header.startsWith('image/') ? header : 'image/jpeg'

  const doc = await payload.create({
    collection: 'media',
    data: {
      alt,
      credit: edamamUrl
        ? 'Illustrative photo of the dish, via Edamam. Recipe via Spoonacular.'
        : 'Original publisher, via Spoonacular',
      license: 'licensed',
    },
    file: {
      data,
      mimetype,
      name: `${slugify(title)}-import.jpg`,
      size: data.byteLength,
    },
  })
  if (edamamUrl) edamamPhotos++
  return doc.id
}

/** Clean slate: retire everything from the single-source pipelines. */
async function purgeOldImports(): Promise<void> {
  let purged = 0
  for (;;) {
    const batch = await payload.find({
      collection: 'recipes',
      where: { provenance: { equals: 'api-imported' } },
      depth: 0,
      limit: 100,
    })
    if (batch.docs.length === 0) break
    for (const recipe of batch.docs) {
      await payload.delete({ collection: 'recipes', id: recipe.id })
      purged++
    }
  }
  for (const slug of ['edamam', 'themealdb']) {
    const author = await payload.find({
      collection: 'authors',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (author.docs[0]) {
      await payload.delete({ collection: 'authors', id: author.docs[0].id })
    }
  }
  if (purged > 0) console.log(`Purged ${purged} previously imported recipes (fresh hybrid source).`)
}

await purgeOldImports()

const authorResult = await payload.find({
  collection: 'authors',
  where: { slug: { equals: 'spoonacular' } },
  limit: 1,
})
const importAuthor =
  authorResult.docs[0] ??
  (await payload.create({
    collection: 'authors',
    data: {
      name: 'Spoonacular',
      slug: 'spoonacular',
      bio: 'Recipe API aggregating published recipes from across the web. Imported entries are machine-mapped and not yet kitchen-tested by us.',
      provenanceDefault: 'api-imported',
    },
  }))

let imported = 0
let skipped = 0
let cuisinesCreated = 0
let edamamPhotos = 0

try {
  for (const target of CUISINES) {
    const cuisineResult = await payload.find({
      collection: 'cuisines',
      where: { slug: { equals: target.slug } },
      limit: 1,
    })
    let cuisine = cuisineResult.docs[0]
    if (!cuisine) {
      cuisine = await payload.create({
        collection: 'cuisines',
        data: {
          name: target.name,
          slug: target.slug,
          region: target.region as never,
          flagEmoji: target.flagEmoji,
          description: target.description,
        },
      })
      cuisinesCreated++
    }

    const search = await spoonacularJson<{ results?: SpoonacularRecipe[] }>(
      `${SPOONACULAR_API}/recipes/complexSearch?cuisine=${encodeURIComponent(target.api)}` +
        `&number=${PER_CUISINE}&sort=popularity&instructionsRequired=true` +
        `&addRecipeInformation=true&addRecipeNutrition=true&fillIngredients=true` +
        `&apiKey=${spoonacularKey}`,
    )
    const results = search.results ?? []
    console.log(`${target.api} → ${cuisine.name}: ${results.length} results`)

    let firstImage: number | null = null

    for (const raw of results) {
      if (!raw.title || !raw.image) {
        skipped++
        continue
      }
      const mapped = mapRecipe(raw)
      if (mapped.steps.length === 0 || mapped.ingredients.length === 0) {
        skipped++
        continue
      }
      const slug = slugify(mapped.title)

      try {
        const heroImage = await upsertImage(mapped.title, mapped.imageUrl)
        firstImage ??= heroImage
        const { imageUrl: _imageUrl, ...recipeData } = mapped

        const existing = await payload.find({
          collection: 'recipes',
          where: { slug: { equals: slug } },
          limit: 1,
        })
        const data = {
          ...recipeData,
          slug,
          heroImage,
          cuisine: cuisine.id,
          author: importAuthor.id,
          provenance: 'api-imported' as const,
          status: 'published' as const,
        }
        if (existing.docs[0]) {
          await payload.update({ collection: 'recipes', id: existing.docs[0].id, data })
        } else {
          await payload.create({ collection: 'recipes', data })
        }
        imported++
      } catch (error) {
        skipped++
        console.warn(`  ✗ ${mapped.title}: ${error instanceof Error ? error.message : error}`)
      }
    }

    if (!cuisine.heroImage && firstImage) {
      await payload.update({ collection: 'cuisines', id: cuisine.id, data: { heroImage: firstImage } })
    }
  }
} catch (error) {
  if (error instanceof QuotaExhausted) {
    console.warn(`\n${error.message}`)
    console.warn('Progress so far is saved — re-run tomorrow (or upgrade the plan) to continue.')
  } else {
    throw error
  }
}

// Stamp only a run that actually landed recipes — a zero-import run (e.g.
// quota already spent before we started) must retry on the next dev start.
if (imported > 0) {
  fs.mkdirSync(path.dirname(STAMP), { recursive: true })
  fs.writeFileSync(STAMP, JSON.stringify({ at: Date.now() }))
}

console.log(
  `\nImport complete — ${imported} recipes (${edamamPhotos} with Edamam photos), ${skipped} skipped, ${cuisinesCreated} hubs created.`,
)
console.log('Every import: provenance api-imported → noindex, visible attribution.')
process.exit(0)
