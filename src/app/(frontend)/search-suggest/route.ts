import { NextResponse, type NextRequest } from 'next/server'

import { countRecipesByCuisine, findCuisines, getPayloadClient } from '@/lib/queries'
import { formatMinutes } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { tasteLabel } from '@/lib/taxonomy'

/**
 * Navbar search completions, served from an in-memory index.
 *
 * The catalog is small enough (a few hundred recipes) that the whole
 * suggestion payload fits comfortably in one process-level array. It rebuilds
 * every five minutes, so a keystroke costs a substring scan over RAM — no
 * database round-trip. Postgres keeps a pg_trgm GIN index on titles as the
 * fast path for the catalog's full-text `like` search; this route skips the
 * database entirely.
 *
 * Ranking: title-prefix matches first, then word-boundary matches, then
 * anywhere-in-title — so "chi" surfaces "Chicken Handi" before "Butter
 * chicken" before "Zucchini".
 *
 * Each suggestion carries the quick-facts line (cuisine · time · serves ·
 * heat · effort · kcal) that decides a click. Lives outside `/api` because
 * Payload owns that path.
 */
export const dynamic = 'force-dynamic'

type IndexedRecipe = {
  slug: string
  title: string
  titleLower: string
  facts: string[]
  image: { url: string; alt: string } | null
}

type IndexedIngredient = {
  slug: string
  name: string
  nameLower: string
  count: number
}

type IndexedCuisine = {
  slug: string
  name: string
  nameLower: string
  flag: string | null
  count: number
}

/** Utility destinations, matched on plain-English keywords. */
const PAGES = [
  { href: '/tonight', title: 'Pick dinner for me', keywords: 'tonight dinner pick decide random' },
  { href: '/taste-night', title: 'Taste Night — the quiz', keywords: 'quiz trivia taste night game' },
  { href: '/students', title: 'Studying hard?', keywords: 'student budget cheap flat batch' },
  { href: '/collections', title: 'My collections', keywords: 'saved collections favourites favorites' },
] as const

const INDEX_TTL_MS = 5 * 60 * 1000

let index: IndexedRecipe[] = []
let cuisineIndex: IndexedCuisine[] = []
let ingredientIndex: IndexedIngredient[] = []
let indexBuiltAt = 0
let building: Promise<void> | null = null

async function rebuildIndex(): Promise<void> {
  const payload = await getPayloadClient()
  const [result, cuisines, counts] = await Promise.all([
    payload.find({
      collection: 'recipes',
      where: { status: { equals: 'published' } },
      sort: '-publishedAt',
      depth: 1,
      limit: 2000,
    }),
    findCuisines(),
    countRecipesByCuisine(),
  ])

  cuisineIndex = cuisines
    .map((cuisine) => ({
      slug: cuisine.slug,
      name: cuisine.name,
      nameLower: cuisine.name.toLowerCase(),
      flag: cuisine.flagEmoji ?? null,
      count: counts.get(String(cuisine.id)) ?? 0,
    }))
    .filter((cuisine) => cuisine.count > 0)

  // Built from the recipes already fetched above — no extra query. Only
  // ingredients something actually cooks with, matching the rule the
  // /ingredients/[slug] route uses, so a suggestion can never lead to a 404.
  const ingredientTally = new Map<string, IndexedIngredient>()
  for (const recipe of result.docs) {
    const seen = new Set<string>()
    for (const row of recipe.ingredients ?? []) {
      const ing = typeof row.ingredient === 'object' ? row.ingredient : null
      if (!ing?.slug || seen.has(ing.slug)) continue
      seen.add(ing.slug)
      const entry = ingredientTally.get(ing.slug) ?? {
        slug: ing.slug,
        name: String(ing.name),
        nameLower: String(ing.name).toLowerCase(),
        count: 0,
      }
      entry.count += 1
      ingredientTally.set(ing.slug, entry)
    }
  }
  ingredientIndex = [...ingredientTally.values()]

  index = result.docs.map((recipe) => {
    const cuisine = typeof recipe.cuisine === 'object' ? recipe.cuisine : null
    const calories = recipe.nutrition?.calories

    return {
      slug: recipe.slug,
      title: recipe.title,
      titleLower: recipe.title.toLowerCase(),
      facts: [
        cuisine?.name,
        formatMinutes(recipe.totalMinutes),
        `Serves ${recipe.servings}`,
        recipe.spiciness >= 3 ? tasteLabel('spiciness', recipe.spiciness) : null,
        tasteLabel('effort', recipe.effort),
        calories ? `${calories} kcal` : null,
      ].filter((fact): fact is string => Boolean(fact)),
      image: imageFrom(recipe.heroImage, 'thumbnail'),
    }
  })
  indexBuiltAt = Date.now()
}

async function ensureIndex(): Promise<void> {
  if (Date.now() - indexBuiltAt < INDEX_TTL_MS && index.length > 0) return
  // Concurrent keystrokes share one rebuild instead of stampeding Payload.
  building ??= rebuildIndex().finally(() => {
    building = null
  })
  await building
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80).toLowerCase()
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  await ensureIndex()

  const prefix: IndexedRecipe[] = []
  const wordStart: IndexedRecipe[] = []
  const anywhere: IndexedRecipe[] = []

  for (const entry of index) {
    if (entry.titleLower.startsWith(q)) prefix.push(entry)
    else if (entry.titleLower.includes(` ${q}`)) wordStart.push(entry)
    else if (entry.titleLower.includes(q)) anywhere.push(entry)
    if (prefix.length >= 6) break
  }

  const results = [...prefix, ...wordStart, ...anywhere]
    .slice(0, 6)
    .map(({ slug, title, facts, image }) => ({ slug, title, facts, image }))

  const cuisines = cuisineIndex
    .filter((c) => c.nameLower.includes(q))
    .sort((a, b) => Number(b.nameLower.startsWith(q)) - Number(a.nameLower.startsWith(q)))
    .slice(0, 2)
    .map(({ slug, name, flag, count }) => ({ slug, name, flag, count }))

  // Ranked by how many recipes use it, so "chilli" offers the one that actually
  // appears in the catalog rather than an alphabetical accident.
  const ingredients = ingredientIndex
    .filter((i) => i.nameLower.includes(q))
    .sort(
      (a, b) =>
        Number(b.nameLower.startsWith(q)) - Number(a.nameLower.startsWith(q)) ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 3)
    .map(({ slug, name, count }) => ({ slug, name, count }))

  const pages = PAGES.filter(
    (page) => page.title.toLowerCase().includes(q) || page.keywords.includes(q),
  ).slice(0, 2)

  return NextResponse.json(
    { results, cuisines, ingredients, pages },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
