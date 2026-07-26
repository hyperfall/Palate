import type { Payload } from 'payload'

import { computeNutrition, type NutritionRow } from './nutrition'

/**
 * Impure wrapper around the pure nutrition core: pulls each linked canonical
 * ingredient's per-100g data and computes a recipe's per-serving macros.
 * Returns null when too little of the recipe can be priced — better to show no
 * number than a confidently-low one built from half the ingredients.
 */

const idOf = (v: unknown): number | null =>
  typeof v === 'object' && v ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null

type Row = { quantity?: string | null; unit?: string | null; ingredient?: unknown; heading?: boolean | null }
type RecipeLike = { ingredients?: Row[] | null; servings?: number | null }

export async function computeRecipeNutrition(
  payload: Payload,
  recipe: RecipeLike,
  { minCoverage = 0.6 }: { minCoverage?: number } = {},
): Promise<{ calories: number; protein: number; carbs: number; fat: number } | null> {
  // Section labels aren't ingredients; counting them would drag coverage down
  // and suppress the number for a recipe we can actually compute.
  const rows = (recipe.ingredients ?? []).filter((r) => !r.heading)
  const ids = [...new Set(rows.map((r) => idOf(r.ingredient)).filter((x): x is number => x != null))]
  if (ids.length === 0) return null

  const ings = await payload.find({
    collection: 'ingredients',
    where: { id: { in: ids } },
    limit: 1000,
    depth: 0,
  })
  const byId = new Map(ings.docs.map((i) => [i.id, i]))

  const nrows: NutritionRow[] = rows.map((r) => {
    const ing = byId.get(idOf(r.ingredient) as number) as
      | {
          densityGPerMl?: number | null
          gramsPerPiece?: number | null
          nutrition?: {
            kcalPer100g?: number | null
            proteinPer100g?: number | null
            carbsPer100g?: number | null
            fatPer100g?: number | null
          } | null
        }
      | undefined
    return {
      quantity: r.quantity,
      unit: r.unit,
      ingredient: ing
        ? { densityGPerMl: ing.densityGPerMl, gramsPerPiece: ing.gramsPerPiece, nutrition: ing.nutrition }
        : null,
    }
  })

  const result = computeNutrition(nrows, recipe.servings ?? 1)
  if (result.coverage < minCoverage) return null
  return result.perServing
}
