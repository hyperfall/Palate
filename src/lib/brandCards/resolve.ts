import { cookies, headers } from 'next/headers'

import type { BrandCard, Recipe } from '@/payload-types'
import { VISITOR_COOKIE } from '@/proxy'
import { countryFromHeaders } from '@/lib/geoHeaders'
import { findActiveBrandCards } from '@/lib/queries'
import { selectBrandCards, type BrandCardInput, type RecipeContext } from './select'

/**
 * The impure shell around the pure `selectBrandCards` core (design spec §6).
 *
 * Everything environment-shaped lives here — Payload document shapes, Vercel
 * geo headers, the rotation cookie — so the selection logic itself stays a
 * plain function over plain data and remains trivially testable.
 */

const idOf = (value: unknown): string | number | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'object') return (value as { id?: string | number }).id
  return value as string | number
}

export function toBrandCardInput(card: BrandCard): BrandCardInput {
  return {
    id: card.id,
    brand: card.brand,
    weight: card.weight ?? 1,
    active: Boolean(card.active),
    startsAt: card.startsAt ?? null,
    endsAt: card.endsAt ?? null,
    targetRegions: (card.targetRegions ?? []).map((r) => ({ code: r.code })),
    assignedCuisines: (card.assignedCuisines ?? [])
      .map(idOf)
      .filter((id): id is string | number => id !== undefined),
    assignedRecipes: (card.assignedRecipes ?? [])
      .map(idOf)
      .filter((id): id is string | number => id !== undefined),
    maxImpressions: card.maxImpressions ?? null,
    impressionsServed: card.impressionsServed ?? 0,
    creatives: (card.creatives ?? []).map((c) => ({ id: c.id, active: c.active })),
  }
}

export function toRecipeContext(recipe: Recipe): RecipeContext {
  return {
    id: recipe.id,
    cuisineId: idOf(recipe.cuisine) ?? null,
    brandSlotIds: (recipe.brandSlots ?? [])
      .map(idOf)
      .filter((id): id is string | number => id !== undefined),
  }
}

/**
 * §4: "Vercel geo headers (region/country) at the edge". Absent locally and for
 * some proxied traffic — an unknown region is passed through as null, and
 * `selectBrandCards` then serves only globally-targeted cards.
 */
async function getRegion(): Promise<string | null> {
  const headerList = await headers()
  // Was Vercel's header alone, which meant region targeting silently resolved
  // to "unknown" behind any other edge — and an unknown region serves only
  // globally-targeted cards, so every regional campaign quietly stopped
  // delivering. Same resolver the shop panel uses.
  return countryFromHeaders((name) => headerList.get(name))
}

async function getRotationState() {
  const cookieStore = await cookies()
  const visitorKey = cookieStore.get(VISITOR_COOKIE)?.value

  return {
    // A visitor arriving before the proxy has issued a cookie (or with cookies
    // blocked) still gets a valid, if non-persistent, rotation.
    visitorKey: visitorKey ?? 'anonymous',
    cursor: 0,
  }
}

/** Resolves the brand cards to render in a given recipe's slot. */
export async function resolveBrandCardsForRecipe(
  recipe: Recipe,
  { limit = 1 }: { limit?: number } = {},
): Promise<BrandCard[]> {
  const [pool, region, rotation] = await Promise.all([
    findActiveBrandCards(),
    getRegion(),
    getRotationState(),
  ])

  const selected = selectBrandCards({
    cards: pool.map(toBrandCardInput),
    recipe: toRecipeContext(recipe),
    region,
    rotation,
    limit,
  })

  const byId = new Map(pool.map((card) => [String(card.id), card]))
  return selected
    .map((card) => byId.get(String(card.id)))
    .filter((card): card is BrandCard => card !== undefined)
}
