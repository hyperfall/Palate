/**
 * Brand-card selection — design spec §6.
 *
 * This is deliberately a **pure function over data it is handed**, with no
 * imports from Payload, Next, or the database. That is the whole point of §2:
 * in Phase 1 the eligibility data is hand-entered in the CMS and passed in
 * here; in Phase 2 the same call is fed by a real targeting service with
 * impression/click logging behind it. The consumer never changes.
 *
 * The spec writes the signature as
 *   selectBrandCards(recipe, region, sessionRotationState)
 * We take one options object instead. Same inputs, but adding Phase-2
 * parameters (frequency caps, budget pacing, experiment arms) becomes an
 * additive change rather than a positional-argument break — which is what
 * "no consumer rewrite" actually requires.
 */

export type BrandCardId = string | number

export type BrandCardInput = {
  id: BrandCardId
  brand: string
  /** Relative share of impressions. 0 disables the card without deactivating it. */
  weight: number
  active: boolean
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  /** ISO country codes. Empty or absent means global. */
  targetRegions?: Array<{ code: string }> | null
  assignedCuisines?: BrandCardId[] | null
  assignedRecipes?: BrandCardId[] | null
}

export type RecipeContext = {
  id: BrandCardId
  cuisineId: BrandCardId | null
  /** Cards the recipe itself opted into, via the `brandSlots` relationship. */
  brandSlotIds?: BrandCardId[]
}

export type RotationState = {
  /** Stable per-visitor value from a cookie. Not a user identifier. */
  visitorKey: string
  /** How many brand slots this visitor has already been shown. */
  cursor?: number
}

export type SelectBrandCardsArgs = {
  cards: BrandCardInput[]
  recipe: RecipeContext
  region: string | null
  rotation: RotationState
  now?: Date
  limit?: number
}

const key = (id: BrandCardId): string => String(id)

function isWithinFlight(card: BrandCardInput, now: Date): boolean {
  if (card.startsAt) {
    const starts = new Date(card.startsAt)
    if (!Number.isNaN(starts.valueOf()) && now < starts) return false
  }
  if (card.endsAt) {
    const ends = new Date(card.endsAt)
    if (!Number.isNaN(ends.valueOf()) && now > ends) return false
  }
  return true
}

function isTargetedAtRecipe(card: BrandCardInput, recipe: RecipeContext): boolean {
  const optedInByRecipe = (recipe.brandSlotIds ?? []).some((id) => key(id) === key(card.id))
  if (optedInByRecipe) return true

  const byRecipe = (card.assignedRecipes ?? []).some((id) => key(id) === key(recipe.id))
  if (byRecipe) return true

  if (recipe.cuisineId === null || recipe.cuisineId === undefined) return false
  return (card.assignedCuisines ?? []).some((id) => key(id) === key(recipe.cuisineId as BrandCardId))
}

function matchesRegion(card: BrandCardInput, region: string | null): boolean {
  const regions = (card.targetRegions ?? []).map((r) => r.code?.trim().toUpperCase()).filter(Boolean)
  if (regions.length === 0) return true // untargeted = global

  // An unplaceable visitor (localhost, proxied traffic, no geo header) must not
  // be shown region-targeted inventory — we cannot honour the targeting promise.
  if (!region) return false

  return regions.includes(region.trim().toUpperCase())
}

/**
 * Smooth weighted round-robin (the nginx SWRR algorithm).
 *
 * Produces a cycle of length `sum(weights)` in which each card appears exactly
 * `weight` times and heavy cards are *interleaved* rather than run back to
 * back. §6 asks for "even exposure — not just random, which clumps"; a naive
 * expansion would emit `aaab`, which clumps just as badly.
 *
 * Cards are sorted by id first so the cycle is stable across page renders no
 * matter what order the database returned them in.
 */
export function buildRotationSchedule(cards: BrandCardInput[]): string[] {
  const pool = cards
    .filter((c) => c.weight > 0)
    .slice()
    .sort((a, b) => key(a.id).localeCompare(key(b.id)))

  if (pool.length === 0) return []

  const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0)
  const current = new Map<string, number>(pool.map((c) => [key(c.id), 0]))
  const schedule: string[] = []

  for (let i = 0; i < totalWeight; i++) {
    let best: BrandCardInput | null = null
    let bestValue = Number.NEGATIVE_INFINITY

    for (const c of pool) {
      const next = (current.get(key(c.id)) ?? 0) + c.weight
      current.set(key(c.id), next)
      if (next > bestValue) {
        bestValue = next
        best = c
      }
    }

    if (!best) break
    current.set(key(best.id), bestValue - totalWeight)
    schedule.push(key(best.id))
  }

  return schedule
}

/**
 * FNV-1a. Small, dependency-free, and well-spread for short strings — we only
 * need it to scatter visitors across the rotation's starting offsets so the
 * first impression isn't always the same brand.
 */
function hashVisitor(visitorKey: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < visitorKey.length; i++) {
    hash ^= visitorKey.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function selectBrandCards({
  cards,
  recipe,
  region,
  rotation,
  now = new Date(),
  limit = 1,
}: SelectBrandCardsArgs): BrandCardInput[] {
  // Step 1 — active, in flight, and targeted at this recipe.
  // Step 2 — and targeted at this visitor's region.
  const eligible = cards.filter(
    (card) =>
      card.active &&
      card.weight > 0 &&
      isWithinFlight(card, now) &&
      isTargetedAtRecipe(card, recipe) &&
      matchesRegion(card, region),
  )

  if (eligible.length === 0 || limit <= 0) return []

  // Step 3 — walk the weighted cycle from this visitor's offset.
  const schedule = buildRotationSchedule(eligible)
  if (schedule.length === 0) return []

  const byId = new Map(eligible.map((c) => [key(c.id), c]))
  const offset = (hashVisitor(rotation.visitorKey) + (rotation.cursor ?? 0)) % schedule.length

  const picked: BrandCardInput[] = []
  const seen = new Set<string>()

  for (let step = 0; step < schedule.length && picked.length < limit; step++) {
    const id = schedule[(offset + step) % schedule.length]
    if (seen.has(id)) continue
    const card = byId.get(id)
    if (!card) continue
    seen.add(id)
    picked.push(card)
  }

  return picked
}
