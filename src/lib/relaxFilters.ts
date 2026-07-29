import { TASTE_AXES, TASTE_AXIS_LABELS } from '@/lib/taxonomy'
import type { CatalogFilters } from '@/lib/filters'

/**
 * When a filter combination returns nothing, work out which single constraint
 * is doing the excluding.
 *
 * The old empty state told the reader to "try widening one of the taste bands",
 * which asks them to guess at something the server already knows. With a small
 * catalog this screen is common, so it should do the work: drop one constraint
 * at a time, count what comes back, and offer the best single relaxation.
 *
 * Pure — the caller supplies the counting, so this stays testable without a
 * database and the page decides how many queries it is willing to spend.
 */

export type Relaxation = {
  /** Filters with exactly one constraint removed. */
  filters: CatalogFilters
  /** What was dropped, in the reader's words: "the 20 minute limit". */
  label: string
  /** How many recipes come back once it's gone. Filled in by the caller. */
  count: number
}

/** Every one-constraint-lighter version of these filters, each with its label. */
export function relaxations(filters: CatalogFilters): Array<Omit<Relaxation, 'count'>> {
  const out: Array<Omit<Relaxation, 'count'>> = []
  const drop = (label: string, patch: Partial<CatalogFilters>) =>
    out.push({ label, filters: { ...filters, ...patch } })

  if (filters.maxMinutes !== null) drop(`the ${filters.maxMinutes} minute limit`, { maxMinutes: null })
  if (filters.maxCalories !== null) drop(`the ${filters.maxCalories} kcal limit`, { maxCalories: null })
  if (filters.minRating !== null) drop('the rating filter', { minRating: null })
  if (filters.maxCost !== null) drop('the budget limit', { maxCost: null })

  // Taste bands one axis at a time — the ones the old copy singled out, now
  // measured rather than guessed at.
  for (const axis of TASTE_AXES) {
    if (!filters.taste[axis]) continue
    const taste = { ...filters.taste }
    delete taste[axis]
    drop(`the ${TASTE_AXIS_LABELS[axis].title.toLowerCase()} band`, { taste })
  }

  // Whole lists, not individual values: "drop Korean" when Korean is the only
  // cuisine chosen is the same as dropping the cuisine filter, and offering
  // both would be noise. Slugs are humanised — "south-korean" is a URL, not
  // something to show a reader.
  const humanise = (slug: string) =>
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  if (filters.cuisines.length)
    drop(filters.cuisines.length === 1 ? `the ${humanise(filters.cuisines[0])} filter` : 'the cuisine filter', { cuisines: [] })
  if (filters.diets.length)
    drop(filters.diets.length === 1 ? `the ${humanise(filters.diets[0])} filter` : 'the dietary filters', { diets: [] })
  if (filters.courses.length) drop('the meal filter', { courses: [] })
  if (filters.ingredients.length) drop('the ingredient filter', { ingredients: [] })
  if (filters.difficulties.length) drop('the difficulty filter', { difficulties: [] })
  if (filters.equipment.length) drop('the equipment filter', { equipment: [] })
  if (filters.onePan) drop('one-pan only', { onePan: false })
  if (filters.makeAhead) drop('make-ahead only', { makeAhead: false })
  if (filters.keepsWell) drop('keeps-well only', { keepsWell: false })

  return out
}

/**
 * The relaxation worth offering: the one that returns the fewest recipes while
 * still returning some.
 *
 * Fewest, not most, on purpose — it's the smallest concession that gets the
 * reader an answer. Dropping the cuisine might return the whole catalog, which
 * technically "works" but throws away what they asked for.
 */
export function bestRelaxation(candidates: Relaxation[]): Relaxation | null {
  const usable = candidates.filter((c) => c.count > 0)
  if (usable.length === 0) return null
  return usable.reduce((best, c) => (c.count < best.count ? c : best))
}
