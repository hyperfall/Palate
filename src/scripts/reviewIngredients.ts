import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { diceCoefficient } from '../lib/ingredients/match'
import { normalizeItem } from '../lib/ingredients/normalize'

/**
 * The ingredient review queue, on the command line.
 *
 * The matcher is deliberately conservative, so unmatched items land as
 * `needsReview: true` stubs rather than mis-linking. That's the safe failure —
 * but only if someone actually works the queue. This report surfaces every stub
 * ranked by how many recipes depend on it (fix the load-bearing ones first) and,
 * where a close canonical already exists, suggests a merge target so you resolve
 * a stub instead of letting a near-duplicate live on.
 *
 *   npm run review:ingredients
 */
const payload = await getPayload({ config })

const review = await payload.find({
  collection: 'ingredients',
  where: { needsReview: { equals: true } },
  limit: 1000,
  depth: 0,
})
const canon = await payload.find({
  collection: 'ingredients',
  where: { needsReview: { not_equals: true } },
  limit: 5000,
  depth: 0,
})
// Suggest merges into any other ingredient — a settled canonical or another
// stub (two stubs like "shiitake" / "shiitake mushroom" should collapse too).
const pool = [...canon.docs, ...review.docs].map((d) => ({
  id: d.id,
  name: String(d.name),
  norm: normalizeItem(String(d.name)),
}))

type Row = { name: string; uses: number; suggest: Array<{ name: string; score: number }> }
const rows: Row[] = []

for (const d of review.docs) {
  const name = String(d.name)
  const norm = normalizeItem(name)

  let uses = 0
  try {
    const c = await payload.count({
      collection: 'recipes',
      where: { 'ingredients.ingredient': { equals: d.id } },
    })
    uses = c.totalDocs
  } catch {
    uses = -1 // couldn't resolve usage — shown as "?"
  }

  const suggest = pool
    .filter((c) => c.id !== d.id)
    .map((c) => ({ name: c.name, score: diceCoefficient(norm, c.norm) }))
    .filter((s) => s.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  rows.push({ name, uses, suggest })
}

rows.sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))

if (rows.length === 0) {
  console.log('\n✓ Nothing to review — the canonical ingredient namespace is clean.\n')
  process.exit(0)
}

console.log(`\n${rows.length} ingredient stub(s) need review — highest recipe impact first:\n`)
for (const r of rows) {
  const usage = r.uses < 0 ? 'usage ?' : `used in ${r.uses} recipe${r.uses === 1 ? '' : 's'}`
  console.log(`• ${r.name}  —  ${usage}`)
  if (r.suggest.length) {
    console.log(`    ↳ maybe merge into: ${r.suggest.map((s) => `${s.name} (${s.score.toFixed(2)})`).join(', ')}`)
  }
}
console.log('')
process.exit(0)
