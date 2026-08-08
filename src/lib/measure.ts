import {
  convertMeasure,
  humanizeQuantity,
  isSpoonable,
  PINCH_BELOW,
  type UnitSystem,
} from '@/lib/units'
import { parseQuantity } from '@/lib/nutrition'

/**
 * Format one ingredient's measure, scaled to the chosen servings and converted
 * to the reader's unit system.
 *
 * Extracted so the recipe page's ingredients panel and cook mode's list produce
 * byte-identical strings. Two copies of this arithmetic would eventually
 * disagree, and a cook checking a quantity mid-recipe against the one they read
 * before starting would have no way to tell which was right.
 */
export type MeasurableIngredient = {
  quantity?: string | null
  unit?: string | null
  ingredient?: { countable?: boolean | null } | number | null
}

export function formatMeasure(
  ing: MeasurableIngredient,
  { factor, unitSystem }: { factor: number; unitSystem: UnitSystem },
): string {
  // parseQuantity, not parseFloat: parseFloat turns "1/2 cup" into "1 cup"
  // and "3/4" into "3" on the recipe page and in cook mode — a reader would
  // use double the intended amount. parseQuantity reads fractions and mixed
  // numbers as the recipe means them.
  // ?? NaN so the Number.isNaN guard below still catches a no-quantity row.
  const parsed = parseQuantity(ing.quantity) ?? Number.NaN
  // Non-numeric ("a handful") is left verbatim — scaling it would be a lie.
  if (Number.isNaN(parsed)) return [ing.quantity, ing.unit].filter(Boolean).join(' ')

  const scaled = parsed * factor
  const canonical = ing.ingredient && typeof ing.ingredient === 'object' ? ing.ingredient : null
  const converted = ing.unit ? convertMeasure(scaled, ing.unit, unitSystem) : { quantity: scaled, unit: '' }
  // Below the smallest spoon, say what a cook would say. Handled here rather
  // than in humanizeQuantity because the unit is dropped along with the number
  // — "a pinch" is the whole measure, and "a pinch tsp" is not English.
  const countable = Boolean(canonical?.countable)
  if (!countable && isSpoonable(converted.unit) && converted.quantity > 0 && converted.quantity < PINCH_BELOW) {
    return 'a pinch'
  }

  const qty = humanizeQuantity(converted.quantity, {
    countable,
    unit: converted.unit,
  })
  return [qty, converted.unit].filter(Boolean).join(' ')
}
