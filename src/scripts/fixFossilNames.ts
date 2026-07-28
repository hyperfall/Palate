import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { slugify } from '../fields/slug'

/**
 * Repair canonical ingredient names left behind by an older normalizer.
 *
 * These rows were written before normalizeItem handled irregular plurals and
 * apostrophes, so the catalog carries "arbol chilly" (from "chillies"),
 * "kaffir lime leave" (from "leaves") and "bird s eye chilly" (apostrophe
 * stripped to a space). The current normalizer produces the right answer for
 * all of them — verified — so this is stale data, not a live bug, and it can't
 * be found by re-normalising the stored name: "arbol chilly" is already a
 * fixpoint. Hence an explicit, reviewable map.
 *
 * The names are public now that /ingredients/[slug] exists, which is what makes
 * this worth repairing rather than ignoring.
 *
 * If a correctly-named row already exists, this MERGES: every recipe's
 * `ingredients[].ingredient` and `steps[].uses` FK is re-pointed at the good
 * row before the fossil is deleted. Otherwise it renames in place.
 *
 *   npm run fix:fossil-names            # report only
 *   npm run fix:fossil-names -- --apply # write
 */
const CORRECTIONS: Record<string, string> = {
  'bay leave': 'bay leaf',
  'kaffir lime leave': 'kaffir lime leaf',
  'fenugreek leave': 'fenugreek leaf',
  'arbol chilly': 'arbol chilli',
  'guajillo chilly': 'guajillo chilli',
  'bird s eye chilly': "bird's eye chilli",
}

const apply = process.argv.includes('--apply')
const payload = await getPayload({ config })

const all = await payload.find({ collection: 'ingredients', limit: 1000, depth: 0 })
const byName = new Map(all.docs.map((d) => [String(d.name), d]))

let renamed = 0
let merged = 0
let missing = 0

for (const [fossil, correct] of Object.entries(CORRECTIONS)) {
  const bad = byName.get(fossil)
  if (!bad) {
    missing += 1
    continue
  }
  const good = byName.get(correct)

  if (!good) {
    console.log(`RENAME  "${fossil}" -> "${correct}"`)
    renamed += 1
    if (apply) {
      await payload.update({
        collection: 'ingredients',
        id: bad.id,
        data: { name: correct, slug: slugify(correct) } as never,
      })
    }
    continue
  }

  console.log(`MERGE   "${fossil}" (#${bad.id}) -> "${correct}" (#${good.id})`)
  merged += 1
  if (!apply) continue

  // Re-point every reference before the row disappears, or recipes lose the
  // canonical link that the whole ingredient backbone depends on.
  const recipes = await payload.find({ collection: 'recipes', limit: 1000, depth: 0 })
  for (const recipe of recipes.docs) {
    const rows = recipe.ingredients ?? []
    const steps = recipe.steps ?? []
    const touchesRows = rows.some((r) => r.ingredient === bad.id)
    const touchesSteps = steps.some((s) => (s.uses ?? []).some((u: unknown) => u === bad.id))
    if (!touchesRows && !touchesSteps) continue

    await payload.update({
      collection: 'recipes',
      id: recipe.id,
      data: {
        ingredients: rows.map((r) => (r.ingredient === bad.id ? { ...r, ingredient: good.id } : r)),
        steps: steps.map((s) => ({
          ...s,
          uses: (s.uses ?? []).map((u: unknown) => (u === bad.id ? good.id : u)),
        })),
      } as never,
    })
  }
  await payload.delete({ collection: 'ingredients', id: bad.id })
}

console.log(
  `\n${apply ? 'Applied' : 'Dry run'}: ${renamed} rename(s), ${merged} merge(s)` +
    (missing ? `, ${missing} already clean` : ''),
)
process.exit(0)
