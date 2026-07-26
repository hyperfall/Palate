import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { foldIngredientRows } from '../lib/ingredients/rows'

/**
 * Repair ingredient lists that were entered (or imported) with qualifier text
 * split onto its own row — "medium tomatoes" / "cut in half" — which the page
 * renders as a phantom ingredient with a dotted leader pointing at no measure,
 * and which mints a canonical stub that then lands in the netted shopping list.
 *
 * Folds each qualifier into the ingredient above it, flags section labels
 * ("To serve") as headings, then deletes any canonical ingredient left behind
 * that is a review stub AND no longer referenced by any recipe.
 *
 * Dry run by default — nothing is written without `--apply`:
 *   npm run fix:ingredient-rows
 *   npm run fix:ingredient-rows -- --apply
 */
const APPLY = process.argv.includes('--apply')
const payload = await getPayload({ config })

type Row = {
  quantity?: string | null
  unit?: string | null
  item: string
  heading?: boolean | null
  ingredient?: unknown
  [k: string]: unknown
}

const recipes = await payload.find({ collection: 'recipes', limit: 1000, depth: 0 })

let touched = 0
for (const r of recipes.docs) {
  const rows = ((r.ingredients ?? []) as Row[]).map((x) => ({ ...x }))
  if (rows.length === 0) continue

  const folded = foldIngredientRows(rows)
  const changed =
    folded.length !== rows.length ||
    folded.some((f, i) => f.item !== rows[i]?.item || Boolean(f.heading) !== Boolean(rows[i]?.heading))
  if (!changed) continue

  touched++
  console.log(`\n${r.title}  (${rows.length} → ${folded.length} rows)`)
  for (const f of folded) {
    const before = rows.find((x) => x.item === f.item)
    if (f.heading) console.log(`   §  ${f.item}   ← marked as a section label`)
    else if (!before) console.log(`   ✎  ${f.item}   ← folded`)
  }

  if (APPLY) {
    // Clear stale links on rows we rewrote; the save hook re-matches them.
    const next = folded.map((f) => (f.heading ? { ...f, ingredient: null } : f))
    await payload.update({ collection: 'recipes', id: r.id, data: { ingredients: next } as never })
  }
}

// Sweep canonical stubs that no recipe references any more.
const stubs = await payload.find({
  collection: 'ingredients',
  where: { needsReview: { equals: true } },
  limit: 1000,
  depth: 0,
})
const orphans: Array<{ id: number; name: string }> = []
for (const s of stubs.docs) {
  const used = await payload.count({
    collection: 'recipes',
    where: { 'ingredients.ingredient': { equals: s.id } },
  })
  if (used.totalDocs === 0) orphans.push({ id: s.id as number, name: String(s.name) })
}

if (orphans.length) {
  console.log(`\n${orphans.length} unreferenced review stub(s):`)
  console.log(`   ${orphans.map((o) => o.name).join(', ')}`)
  if (APPLY) {
    for (const o of orphans) {
      await payload.delete({ collection: 'ingredients', id: o.id }).catch(() => {})
    }
    console.log('   → deleted')
  }
}

console.log(
  `\n${touched} recipe(s) ${APPLY ? 'repaired' : 'would be repaired'}, ` +
    `${orphans.length} stub(s) ${APPLY ? 'deleted' : 'would be deleted'}` +
    `${APPLY ? '' : '  — re-run with --apply to write'}`,
)
process.exit(0)
