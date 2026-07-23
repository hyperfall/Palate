import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { computeRecipeNutrition } from '../lib/recipeNutrition'

/**
 * Backfill per-serving nutrition on every recipe from the seeded ingredient
 * data. Idempotent. Run after `seed:nutrition` (or after seeding recipes):
 * `npm run compute:nutrition`.
 */
const payload = await getPayload({ config })
const recipes = await payload.find({ collection: 'recipes', limit: 1000, depth: 0 })

let set = 0
let skipped = 0
for (const r of recipes.docs) {
  const n = await computeRecipeNutrition(payload, r as never)
  if (!n) {
    skipped++
    console.log(`— ${r.title}: skipped (insufficient coverage)`)
    continue
  }
  await payload.update({ collection: 'recipes', id: r.id, data: { nutrition: n } as never })
  set++
  console.log(`✓ ${r.title}: ${n.calories} kcal · ${n.protein}p ${n.carbs}c ${n.fat}f`)
}
console.log(`\nnutrition set on ${set} recipes; ${skipped} skipped`)
process.exit(0)
