import { convertMeasure, humanizeQuantity, type UnitSystem } from '@/lib/units'

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
  const parsed = ing.quantity ? Number.parseFloat(ing.quantity) : Number.NaN
  // Non-numeric ("a handful") is left verbatim — scaling it would be a lie.
  if (Number.isNaN(parsed)) return [ing.quantity, ing.unit].filter(Boolean).join(' ')

  const scaled = parsed * factor
  const canonical = ing.ingredient && typeof ing.ingredient === 'object' ? ing.ingredient : null
  const converted = ing.unit ? convertMeasure(scaled, ing.unit, unitSystem) : { quantity: scaled, unit: '' }
  const qty = humanizeQuantity(converted.quantity, {
    countable: Boolean(canonical?.countable),
    unit: converted.unit,
  })
  return [qty, converted.unit].filter(Boolean).join(' ')
}
