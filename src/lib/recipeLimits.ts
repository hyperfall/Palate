/**
 * Realistic bounds for the numbers a recipe carries. The studio steppers clamp
 * to these client-side, but a form can be bypassed — a crafted POST could send
 * `servings: 999999` or a negative cook time. So the route validates against the
 * SAME limits server-side; this module is the single source both import, so the
 * two can never drift.
 *
 * Bounds are generous ceilings, not tight guesses — a 48-hour sous-vide or a
 * 100-serving catering batch is real; 10,000 cups of flour is not.
 */
export const RECIPE_LIMITS = {
  servings: { min: 1, max: 100 },
  prepMinutes: { min: 0, max: 2880 }, // up to 48h (overnight marinades, multi-day)
  cookMinutes: { min: 0, max: 2880 }, // up to 48h (smoking, sous-vide, fermentation)
  taste: { min: 0, max: 5 }, // the 0–5 gauge scale
  quantityMax: 10_000, // per-ingredient numeric ceiling
} as const

/** Long-form Story markdown cap — a story, not a novel; keeps "recipe first" honest. */
export const STORY_MARKDOWN_CAP = 5000

// A real recipe is at least two ingredients and two steps. Both the studio form
// and the submit route import these so the floor can't drift between them.
export const MIN_INGREDIENTS = 2
export const MIN_STEPS = 2

const TASTE_AXES = ['spiciness', 'sweetness', 'richness', 'effort'] as const

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

export function intInRange(v: unknown, range: { min: number; max: number }): boolean {
  return isInt(v) && v >= range.min && v <= range.max
}

/** Every real number token in a quantity string ("2", "1/2", "2-3", "1.5"). */
const NUMBER_TOKEN = /\d+(?:\.\d+)?/g

/** A human error if a quantity string carries an out-of-range number, else null. */
export function quantityRangeError(quantity: unknown): string | null {
  if (quantity == null || quantity === '') return null
  if (typeof quantity !== 'string') return 'Ingredient quantity is invalid.'
  const nums = quantity.match(NUMBER_TOKEN)
  if (!nums) return null
  for (const n of nums) {
    const v = Number.parseFloat(n)
    if (Number.isFinite(v) && v > RECIPE_LIMITS.quantityMax) {
      return `Ingredient quantities can’t exceed ${RECIPE_LIMITS.quantityMax}.`
    }
  }
  return null
}

export type RecipeNumbers = {
  servings?: unknown
  prepMinutes?: unknown
  cookMinutes?: unknown
  spiciness?: unknown
  sweetness?: unknown
  richness?: unknown
  effort?: unknown
  ingredients?: Array<{ quantity?: unknown }> | unknown
}

/**
 * Returns a human-readable error for the first number outside its realistic
 * range, or null when every value is sane. Used on both the client (friendly
 * pre-submit feedback) and the server (the actual gate).
 */
export function validateRecipeNumbers(r: RecipeNumbers): string | null {
  const L = RECIPE_LIMITS
  if (!intInRange(r.servings, L.servings)) {
    return `Servings must be a whole number from ${L.servings.min} to ${L.servings.max}.`
  }
  if (!intInRange(r.prepMinutes, L.prepMinutes)) {
    return `Prep time must be from ${L.prepMinutes.min} to ${L.prepMinutes.max} minutes.`
  }
  if (!intInRange(r.cookMinutes, L.cookMinutes)) {
    return `Cook time must be from ${L.cookMinutes.min} to ${L.cookMinutes.max} minutes.`
  }
  for (const axis of TASTE_AXES) {
    if (!intInRange(r[axis], L.taste)) {
      return `Taste ratings must be from ${L.taste.min} to ${L.taste.max}.`
    }
  }
  if (Array.isArray(r.ingredients)) {
    for (const ing of r.ingredients) {
      const err = quantityRangeError((ing as { quantity?: unknown })?.quantity)
      if (err) return err
    }
  }
  return null
}
