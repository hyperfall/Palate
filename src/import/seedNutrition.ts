import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { INGREDIENT_NUTRITION } from '../data/ingredientNutrition'

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
  const n = INGREDIENT_NUTRITION[key]
  if (!n) {
    missed.push(ing.name)
    continue
  }
  await payload.update({
    collection: 'ingredients',
    id: ing.id,
    data: {
      nutrition: {
        kcalPer100g: n.kcal,
        proteinPer100g: n.protein,
        carbsPer100g: n.carbs,
        fatPer100g: n.fat,
        source: 'USDA (seed — review)',
      },
      ...(n.gramsPerPiece != null ? { gramsPerPiece: n.gramsPerPiece } : {}),
      ...(n.densityGPerMl != null ? { densityGPerMl: n.densityGPerMl } : {}),
    } as never,
  })
  set++
}

console.log(`nutrition set on ${set}/${all.docs.length} ingredients`)
if (missed.length) console.log(`unmatched (${missed.length}): ${missed.join(', ')}`)
process.exit(0)
