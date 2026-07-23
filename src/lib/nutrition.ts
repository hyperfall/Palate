/**
 * Recipe nutrition, computed from structured ingredient rows and per-100g data
 * on the canonical ingredients — no third-party service at runtime. Pure and
 * deterministic so it's trivially testable; the impure seed/compute wrappers
 * hand it plain data.
 *
 * The catch with "just multiply": a recipe row is `{quantity, unit, ingredient}`
 * where unit may be a weight (g), a volume (tbsp — needs density), or a count
 * ("2 eggs" — needs grams-per-piece). We convert to grams, scale each
 * ingredient's per-100g nutrients, sum, and divide by servings. A `coverage`
 * ratio reports how much of the recipe we could actually price, so a caller
 * never shows a confidently-wrong number built from half the ingredients.
 */

export type IngredientNutrition = {
  kcalPer100g?: number | null
  proteinPer100g?: number | null
  carbsPer100g?: number | null
  fatPer100g?: number | null
}

export type NutritionIngredient = {
  densityGPerMl?: number | null
  gramsPerPiece?: number | null
  nutrition?: IngredientNutrition | null
}

export type NutritionRow = {
  quantity?: string | null
  unit?: string | null
  ingredient?: NutritionIngredient | null
}

export type Macros = { calories: number; protein: number; carbs: number; fat: number }

export type NutritionResult = {
  perServing: Macros
  /** Fraction of rows (0–1) that had enough data to price. */
  coverage: number
  usable: number
  total: number
}

// grams per 1 unit
const WEIGHT_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1, gr: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
}

// millilitres per 1 unit (multiplied by density → grams)
const VOLUME_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, litre: 1000, liters: 1000, litres: 1000,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  cup: 240, cups: 240,
  'fl oz': 29.5735, 'fluid ounce': 29.5735,
  pint: 473.176, quart: 946.353,
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

/** Free-typed quantity → a number, or null when it's non-numeric ("a pinch"). */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null

  // "2-3", "2 to 3", "2–3" → average
  const range = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)$/)
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2

  // "1 1/2" → mixed number
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])

  // "1/2" → fraction
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])

  // "½", "1½"
  const uniOnly = UNICODE_FRACTIONS[s]
  if (uniOnly != null) return uniOnly
  const numPlusUni = s.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅛⅜⅝⅞])$/)
  if (numPlusUni) return Number(numPlusUni[1]) + (UNICODE_FRACTIONS[numPlusUni[2]] ?? 0)

  // leading decimal/integer ("400", "1.5", "2 large")
  const num = s.match(/^(\d+(?:\.\d+)?)/)
  if (num) return parseFloat(num[1])

  return null
}

/** quantity + unit + the ingredient's own measures → grams, or null if unconvertible. */
export function toGrams(quantity: number, unitRaw: string | null | undefined, ing: NutritionIngredient): number | null {
  const unit = String(unitRaw ?? '').trim().toLowerCase()

  if (unit in WEIGHT_G) return quantity * WEIGHT_G[unit]
  if (unit in VOLUME_ML) return quantity * VOLUME_ML[unit] * (ing.densityGPerMl ?? 1)

  // No/other unit ⇒ a count of pieces ("2 eggs", "1 onion", "1 tin"). Needs a
  // per-piece weight; without one we can't honestly price it. `cm` (e.g. ginger)
  // and other length units correctly fall through to null.
  if (unit === 'cm' || unit === 'inch' || unit === 'in') return null
  if (ing.gramsPerPiece != null && ing.gramsPerPiece > 0) return quantity * ing.gramsPerPiece
  return null
}

export function computeNutrition(rows: NutritionRow[], servings: number): NutritionResult {
  let kcal = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let usable = 0
  // Denominator is rows that STATE an amount — a no-quantity garnish ("spring
  // onion, to serve") is inherently unpriceable and shouldn't count against
  // coverage. So coverage = "of ingredients with an amount, how many we priced".
  let quantified = 0

  for (const row of rows) {
    const qty = parseQuantity(row.quantity)
    if (qty == null || qty <= 0) continue
    quantified++

    const ing = row.ingredient
    const n = ing?.nutrition
    if (!ing || !n || n.kcalPer100g == null) continue

    const grams = toGrams(qty, row.unit, ing)
    if (grams == null || grams <= 0) continue

    const f = grams / 100
    kcal += (n.kcalPer100g ?? 0) * f
    protein += (n.proteinPer100g ?? 0) * f
    carbs += (n.carbsPer100g ?? 0) * f
    fat += (n.fatPer100g ?? 0) * f
    usable++
  }

  const s = Math.max(1, Math.round(servings) || 1)
  return {
    total: quantified,
    usable,
    coverage: quantified ? usable / quantified : 0,
    perServing: {
      calories: Math.round(kcal / s),
      protein: Math.round(protein / s),
      carbs: Math.round(carbs / s),
      fat: Math.round(fat / s),
    },
  }
}
