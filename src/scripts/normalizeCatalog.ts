import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * One-time: re-save every recipe so the ingredient-normalization hook links
 * each ingredient row to a canonical ingredient. Ingredient-aware search can
 * only match linked rows. Idempotent — already-linked rows are left alone by the
 * hook. Run: npm run normalize:catalog
 */
async function run() {
  const payload = await getPayload({ config })
  const recipes = await payload.find({ collection: 'recipes', limit: 1000, depth: 0 })
  for (const r of recipes.docs) {
    await payload.update({ collection: 'recipes', id: r.id, data: {} as never })
    console.log(`normalized ${r.slug}`)
  }
  console.log(`done — ${recipes.docs.length} recipes`)
  process.exit(0)
}
void run()
