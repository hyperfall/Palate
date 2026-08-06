import 'dotenv/config'

import { getPayloadClient } from '@/lib/queries'

/**
 * Clear community star ratings.
 *
 *   npm run reset:ratings            # report what would go
 *   npm run reset:ratings -- --apply
 *
 * For before launch, when the only votes on the board are your own from
 * testing. One real rating makes a recipe read as "1 star" to every visitor,
 * which is worse than no rating at all: a single test vote becomes a verdict.
 *
 * Deletes through Payload rather than SQL, deliberately. A rating lives in two
 * places — the row, and the recipe's denormalised ratingSum/ratingCount — and a
 * third value, ratingScore, is derived from those and drives sort and filter.
 * Deleting the row fires the collection's afterDelete hook, which re-syncs the
 * aggregate, which in turn re-derives ratingScore. Going at the tables directly
 * would clear the votes and leave every recipe still sorted by a score for
 * ratings that no longer exist.
 *
 * Editorial ratings are left alone. They are an editor's deliberate judgement,
 * not a visitor's vote, and nothing here has any business clearing them.
 */

const apply = process.argv.includes('--apply')

const payload = await getPayloadClient()

const ratings = await payload.find({ collection: 'ratings', depth: 1, limit: 1000 })

if (ratings.totalDocs === 0) {
  console.log('\nNo community ratings to clear.\n')
  process.exit(0)
}

console.log(`\nCommunity ratings — ${apply ? 'clearing' : 'dry run'}`)
for (const doc of ratings.docs as unknown as Array<Record<string, unknown>>) {
  const recipe = doc.recipe as { slug?: string } | number | null
  const slug = typeof recipe === 'object' && recipe ? (recipe.slug ?? '?') : String(recipe)
  console.log(`  ${String(doc.stars)}★  ${slug}`)
}

if (apply) {
  for (const doc of ratings.docs) {
    // One at a time so each fires afterDelete and re-syncs its own recipe.
    await payload.delete({ collection: 'ratings', id: doc.id })
  }
}

console.log(`\n  ${ratings.totalDocs} rating(s) ${apply ? 'deleted' : 'would be deleted'}`)

// Prove the aggregates followed, rather than assuming the hook ran.
const stale = await payload.find({
  collection: 'recipes',
  where: { or: [{ ratingCount: { greater_than: 0 } }, { ratingSum: { greater_than: 0 } }] },
  depth: 0,
  limit: 100,
})
if (apply) {
  console.log(
    stale.totalDocs === 0
      ? '  every recipe aggregate is back to zero'
      : `  WARNING: ${stale.totalDocs} recipe(s) still carry an aggregate`,
  )
  for (const d of stale.docs as unknown as Array<Record<string, unknown>>) {
    console.log(`    ${String(d.slug)}: sum ${String(d.ratingSum)}, count ${String(d.ratingCount)}`)
  }
} else {
  console.log('\nNothing written. Re-run with --apply.')
}

console.log('')
process.exit(0)
