import { cache } from 'react'

import { tallyPairings } from '@/lib/ingredients/pairing'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { Author, BrandCard, Cuisine, Recipe } from '@/payload-types'
import { buildWhere, sortExpression, type CatalogFilters } from './filters'
import { scoreRecipe, bandRecipes, type Have, type Bands, type RequiredIngredient } from './pantry'
import { distance } from './tasteProfile'

/**
 * Read-side data access, via Payload's local API straight against Postgres
 * (design spec §7). Every public query filters to published recipes explicitly:
 * the collection's access control covers HTTP callers, but the local API runs
 * with access overridden, so the constraint has to be stated here.
 */

export async function getPayloadClient() {
  return getPayload({ config })
}

const PUBLISHED = { status: { equals: 'published' } } as const

export type CatalogPage = {
  recipes: Recipe[]
  totalDocs: number
  totalPages: number
  page: number
}

export async function findRecipes(
  filters: CatalogFilters,
  { page = 1, limit = 24 }: { page?: number; limit?: number } = {},
): Promise<CatalogPage> {
  const payload = await getPayloadClient()

  // "For your taste" ranks by distance to the saved profile — a computed order
  // the DB sort can't express, so load the matched set and sort/paginate in app
  // (the catalog is small). Falls through to the normal path with no profile.
  if (filters.sort === 'foryou' && filters.tasteVector) {
    const tv = filters.tasteVector
    // Rank on the four taste columns alone — no relations, no limit. The old
    // shape pulled 500 whole recipes at depth 1 (hero image, author and cuisine
    // joined for every row) to read four numbers, and silently truncated the
    // catalog at 500 once it grew past that. Score cheap, hydrate only the page
    // actually shown.
    const scoring = await payload.find({
      collection: 'recipes',
      where: buildWhere(filters) as never,
      depth: 0,
      pagination: false,
      select: { spiciness: true, sweetness: true, richness: true, effort: true },
    })
    const ranked = [...scoring.docs].sort(
      (a, b) =>
        distance(tv, {
          spiciness: a.spiciness ?? 0,
          sweetness: a.sweetness ?? 0,
          richness: a.richness ?? 0,
          effort: a.effort ?? 0,
        }) -
        distance(tv, {
          spiciness: b.spiciness ?? 0,
          sweetness: b.sweetness ?? 0,
          richness: b.richness ?? 0,
          effort: b.effort ?? 0,
        }),
    )
    const totalDocs = ranked.length
    const start = (page - 1) * limit
    const pageIds = ranked.slice(start, start + limit).map((r) => r.id)

    // Fetch the page's rows in one query, then restore the ranked order — an
    // `in` filter returns them in the database's order, not ours.
    const hydrated = pageIds.length
      ? await payload.find({
          collection: 'recipes',
          where: { id: { in: pageIds } } as never,
          depth: 1,
          limit: pageIds.length,
        })
      : { docs: [] as Recipe[] }
    const byId = new Map(hydrated.docs.map((r) => [r.id, r]))

    return {
      recipes: pageIds.map((id) => byId.get(id)).filter((r): r is Recipe => Boolean(r)),
      totalDocs,
      totalPages: Math.max(1, Math.ceil(totalDocs / limit)),
      page,
    }
  }

  const result = await payload.find({
    collection: 'recipes',
    where: buildWhere(filters) as never,
    sort: sortExpression(filters.sort),
    depth: 1,
    page,
    limit,
  })

  return {
    recipes: result.docs,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? 1,
  }
}

/**
 * Wrapped in React `cache` because generateMetadata and the page body each ask
 * for the same recipe: without it that's two depth-2 reads (cuisine, every
 * ingredient's canonical link and substitutions, every step's `uses`) per
 * render instead of one.
 */
export const findRecipeBySlug = cache(async (slug: string): Promise<Recipe | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: { and: [PUBLISHED, { slug: { equals: slug } }] },
    // depth 2 resolves: the cuisine's own hero image (breadcrumbs/related), each
    // ingredient's canonical link → its substitutions, and each step's `uses` →
    // ingredient names. Substitutions and cook-mode step chips depend on this —
    // don't lower it without moving those reads to a shallower shape.
    depth: 2,
    limit: 1,
  })
  return result.docs[0] ?? null
})

export async function findAllRecipeSlugs(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: PUBLISHED,
    depth: 0,
    limit: 1000,
    select: { slug: true, updatedAt: true },
  })
  return result.docs.map((doc) => ({ slug: doc.slug, updatedAt: doc.updatedAt }))
}

/**
 * Every cuisine, for hubs, filter chips, the studio dropdown and the search
 * index.
 *
 * `withImages` is opt-in because depth 1 joins the media row behind each
 * cuisine's hero image — 208+ joins — and most callers only read name, slug and
 * flag. Only the pages that actually render a cuisine photo pay for it.
 */
export async function findCuisines({ withImages = false } = {}): Promise<Cuisine[]> {
  const payload = await getPayloadClient()
  // All cuisines (208+ seeded) — never truncate, or the studio dropdown silently
  // drops options past the first page (this is why "Levantine" went missing).
  const result = await payload.find({
    collection: 'cuisines',
    depth: withImages ? 1 : 0,
    limit: 1000,
    sort: 'name',
  })
  return result.docs
}

export async function findCuisineBySlug(slug: string): Promise<Cuisine | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'cuisines',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })
  return result.docs[0] ?? null
}

/** Recipe counts per cuisine, for the hub index. One query, not one per cuisine. */
/**
 * One pass over the published set, both tallies. The catalog and home pages ask
 * for cuisine counts and diet counts together; as two functions that was two
 * full scans of the same rows per request. `cache` also collapses repeat calls
 * within a single render.
 */
const countFacets = cache(async (): Promise<{ cuisine: Map<string, number>; diet: Map<string, number> }> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: PUBLISHED,
    depth: 0,
    limit: 1000,
    select: { cuisine: true, dietaryTags: true },
  })

  const cuisine = new Map<string, number>()
  const diet = new Map<string, number>()
  for (const doc of result.docs) {
    const id = typeof doc.cuisine === 'object' ? doc.cuisine?.id : doc.cuisine
    if (id !== undefined && id !== null) {
      const key = String(id)
      cuisine.set(key, (cuisine.get(key) ?? 0) + 1)
    }
    for (const tag of doc.dietaryTags ?? []) {
      diet.set(tag, (diet.get(tag) ?? 0) + 1)
    }
  }
  return { cuisine, diet }
})

export async function countRecipesByCuisine(): Promise<Map<string, number>> {
  return (await countFacets()).cuisine
}

/**
 * Published-recipe count per dietary tag. Drives coverage-aware filter chips:
 * an allergen with no tagged recipes (e.g. "nut-free" before anything is
 * tagged) should not offer a filter that always returns an empty page.
 */
export async function countRecipesByDietTag(): Promise<Map<string, number>> {
  return (await countFacets()).diet
}

/**
 * The full active brand-card pool. Phase 1 hands this whole set to
 * `selectBrandCards`, which does the targeting in memory — the pool is
 * hand-curated and small. Phase 2 replaces this call with the targeting
 * service; `selectBrandCards` itself does not change (§6).
 */
export async function findActiveBrandCards(): Promise<BrandCard[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'brandCards',
    where: { active: { equals: true } },
    depth: 1,
    limit: 200,
  })
  return result.docs
}

/** Editorial picks for the home page: the most recently published recipes. */
export async function findFeaturedRecipes(limit = 6): Promise<Recipe[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: PUBLISHED,
    sort: '-publishedAt',
    depth: 1,
    limit,
  })
  return result.docs
}

/** Same cuisine, excluding the recipe being viewed. */
export async function findRelatedRecipes(recipe: Recipe, limit = 3): Promise<Recipe[]> {
  const cuisineId = typeof recipe.cuisine === 'object' ? recipe.cuisine?.id : recipe.cuisine
  if (cuisineId === undefined || cuisineId === null) return []

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: {
      and: [PUBLISHED, { cuisine: { equals: cuisineId } }, { id: { not_equals: recipe.id } }],
    },
    depth: 1,
    limit,
  })
  return result.docs
}

/** A creator's public profile, resolved by @handle. Depth 1 populates the avatar. */
/** Cached: the creator page's metadata and body both look the same author up. */
export const findAuthorByHandle = cache(async (handle: string): Promise<Author | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'authors',
    where: { handle: { equals: handle } },
    depth: 1,
    limit: 1,
  })
  return result.docs[0] ?? null
})

/**
 * Published recipes by one author, newest first — the creator profile grid.
 *
 * Cached per render: the page's metadata wants only the count while the body
 * wants the list. They must pass the SAME arguments to share the query — React
 * `cache` keys on them — so the metadata call uses the default limit too.
 */
export const findRecipesByAuthor = cache(async function findRecipesByAuthor(
  authorId: number,
  { limit = 48 }: { limit?: number } = {},
): Promise<CatalogPage> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: { and: [PUBLISHED, { author: { equals: authorId } }] },
    sort: '-publishedAt',
    depth: 1,
    limit,
  })
  return {
    recipes: result.docs,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? 1,
  }
})

/** Authors that carry a public handle — the set of buildable creator profiles. */
/** One canonical ingredient, with its substitutions resolved. */
export const findIngredientBySlug = cache(async (slug: string) => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'ingredients',
    where: { slug: { equals: slug } },
    // depth 1 resolves each substitution's `sub` relation to a real ingredient.
    depth: 1,
    limit: 1,
  })
  return result.docs[0] ?? null
})

/**
 * How many published recipes use each canonical ingredient, keyed by slug.
 * Cached, because the sitemap, the pantry index and generateStaticParams all
 * ask the same question during one render.
 */
export const findIngredientUsage = cache(async (): Promise<Map<string, number>> => {
  const payload = await getPayloadClient()
  const recipes = await payload.find({
    collection: 'recipes',
    where: PUBLISHED,
    depth: 1,
    pagination: false,
    select: { ingredients: true },
  })
  const counts = new Map<string, number>()
  for (const r of recipes.docs) {
    // One vote per recipe, matching the pairing tally: a recipe listing an
    // item twice is still one recipe that uses it.
    const seen = new Set<string>()
    for (const row of r.ingredients ?? []) {
      const slug = typeof row.ingredient === 'object' ? row.ingredient?.slug : null
      if (!slug || seen.has(slug)) continue
      seen.add(slug)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return counts
})

/** Ingredient slugs at least one published recipe actually uses. */
export async function findUsedIngredientSlugs(): Promise<string[]> {
  return [...(await findIngredientUsage()).keys()]
}

export type IngredientGraph = {
  recipes: Recipe[]
  /** Ingredients that most often appear alongside this one, commonest first. */
  pairsWith: Array<{ id: number; name: string; slug: string; count: number }>
}

/**
 * The graph around one ingredient: what it is cooked in, and what it is cooked
 * with. "Pairs with" is counted from the recipes themselves rather than
 * authored by hand — the structured ingredient backbone paying out.
 */
export const findIngredientGraph = cache(async (ingredientId: number): Promise<IngredientGraph> => {
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'recipes',
    where: { and: [PUBLISHED, { 'ingredients.ingredient': { equals: ingredientId } }] },
    sort: '-publishedAt',
    depth: 1,
    limit: 48,
  })

  // Every co-occurrence counts. Requiring two would hide almost everything
  // while the catalog is small, and a single shared recipe is still a true
  // answer to "what is this cooked with" — the page shows the count only when
  // it's above one, so the strength of a pairing is never overstated.
  return { recipes: found.docs, pairsWith: tallyPairings(found.docs, ingredientId) }
})

export async function findAuthorsWithHandles(): Promise<Author[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'authors',
    where: { handle: { exists: true } },
    depth: 0,
    limit: 1000,
  })
  return result.docs.filter((author) => Boolean(author.handle))
}

/**
 * "What can I make from what I have" — score every published recipe against
 * the cook's pantry and band it (cookNow / almost / gettingThere). Depth 2
 * resolves each ingredient row's canonical ingredient and that ingredient's
 * substitutions, both of which `scoreRecipe` needs. Only ingredient rows
 * linked to a canonical ingredient can match (see normalizeCatalog.ts).
 */
export async function findRecipesByPantry(
  have: Have[],
  { maxMinutes = null }: { maxMinutes?: number | null } = {},
): Promise<Bands<Recipe>> {
  if (have.length === 0) return { cookNow: [], almost: [], gettingThere: [] }
  const payload = await getPayloadClient()
  const where: Record<string, unknown> = { and: [PUBLISHED] as Record<string, unknown>[] }
  if (maxMinutes) (where.and as Record<string, unknown>[]).push({ totalMinutes: { less_than_equal: maxMinutes } })

  // Score on ingredients alone. depth 2 is genuinely required here — it walks
  // each row's canonical ingredient through to its substitutions — but `select`
  // keeps that expansion off every other relation, so this no longer joins the
  // hero image, cuisine, author and step `uses` of the whole published catalog
  // just to compare ingredient lists.
  const result = await payload.find({
    collection: 'recipes',
    where: where as never,
    depth: 2,
    pagination: false,
    select: { ingredients: true },
  })

  const scored = result.docs.map((recipe) => {
    const required: RequiredIngredient[] = []
    let synthetic = 0
    for (const row of recipe.ingredients ?? []) {
      if (typeof row.ingredient === 'object' && row.ingredient) {
        required.push({
          id: row.ingredient.id as number,
          name: String(row.ingredient.name),
          substitutions: (row.ingredient as { substitutions?: unknown }).substitutions as never,
        })
      } else if (row.item && String(row.item).trim()) {
        // An unlinked row shouldn't occur once normalize:catalog has run, but if
        // one slips through (a future ingest that skips the hook), count it as an
        // unmatchable requirement — a negative id is never in the pantry — so a
        // recipe we can't fully verify never falsely lands in "Cook now". Staple
        // names are still dropped by scoreRecipe's name check.
        required.push({ id: -(++synthetic), name: String(row.item), substitutions: null })
      }
    }
    return scoreRecipe(recipe, required, have)
  })

  // Only the recipes that actually survive banding get fetched in full, and in
  // one query rather than one per card.
  const bands = bandRecipes(scored)
  const keep = [...bands.cookNow, ...bands.almost, ...bands.gettingThere]
  if (keep.length === 0) return { cookNow: [], almost: [], gettingThere: [] }

  const hydrated = await payload.find({
    collection: 'recipes',
    where: { id: { in: keep.map((s) => s.recipe.id) } } as never,
    depth: 1,
    limit: keep.length,
  })
  const byId = new Map(hydrated.docs.map((r) => [r.id, r]))
  const swap = (list: typeof keep) =>
    list
      .map((s) => ({ ...s, recipe: byId.get(s.recipe.id) }))
      .filter((s): s is typeof s & { recipe: Recipe } => Boolean(s.recipe))

  return {
    cookNow: swap(bands.cookNow),
    almost: swap(bands.almost),
    gettingThere: swap(bands.gettingThere),
  }
}
