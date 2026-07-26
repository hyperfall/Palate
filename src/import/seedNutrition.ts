import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import usdaData from '../data/usdaNutrition.json'

import { INGREDIENT_NUTRITION } from '../data/ingredientNutrition'

type UsdaEntry = {
  kcal: number
  protein: number
  carbs: number
  fat: number
  saturates?: number
  sugars?: number
  fibre?: number
  salt?: number
  gramsPerPiece?: number
  source?: string
}
const USDA = usdaData as Record<string, UsdaEntry>

/**
 * Writes per-100g nutrition (+ piece weight, + density) onto the canonical
 * ingredients from the committed USDA-based seed. Idempotent: re-running just
 * refreshes the values. Unmatched ingredients are listed so the seed file can
 * grow with the catalog. Run: `npm run seed:nutrition`.
 */
const payload = await getPayload({ config })
const all = await payload.find({ collection: 'ingredients', limit: 1000 })

let set = 0
const missed: string[] = []

for (const ing of all.docs) {
  const key = ing.name.trim().toLowerCase()
  // The USDA build (genuine sourced values, full UK nutrient set) is primary;
  // the hand-curated table remains the fallback for foods USDA doesn't carry
  // (gochujang, dashi…) and the authority on density/piece weights it defines.
  const u = USDA[key]
  const c = INGREDIENT_NUTRITION[key]
  if (!u && !c) {
    missed.push(ing.name)
    continue
  }
  const base = u ?? {
    kcal: c!.kcal,
    protein: c!.protein,
    carbs: c!.carbs,
    fat: c!.fat,
  }
  const gramsPerPiece = c?.gramsPerPiece ?? u?.gramsPerPiece
  const densityGPerMl = c?.densityGPerMl
  await payload.update({
    collection: 'ingredients',
    id: ing.id,
    data: {
      nutrition: {
        kcalPer100g: base.kcal,
        proteinPer100g: base.protein,
        carbsPer100g: base.carbs,
        fatPer100g: base.fat,
        saturatesPer100g: u?.saturates ?? null,
        sugarsPer100g: u?.sugars ?? null,
        fibrePer100g: u?.fibre ?? null,
        saltPer100g: u?.salt ?? null,
        source: u ? `USDA SR Legacy: ${u.source ?? ''}` : 'curated seed (USDA-derived, review)',
      },
      ...(gramsPerPiece != null ? { gramsPerPiece } : {}),
      ...(densityGPerMl != null ? { densityGPerMl } : {}),
    } as never,
  })
  set++
}

console.log(`nutrition set on ${set}/${all.docs.length} ingredients`)
if (missed.length) console.log(`unmatched (${missed.length}): ${missed.join(', ')}`)
process.exit(0)
