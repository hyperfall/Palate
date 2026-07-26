import type { Payload } from 'payload'

/**
 * Recompute a recipe's denormalised rating aggregate from the Ratings rows —
 * the source of truth. The old read-modify-write in the rate endpoint could
 * lose concurrent votes forever; recomputing from the rows means any stale
 * write converges back to the truth on the next sync. Also called after admin
 * deletes so the aggregate can't drift from the collection.
 */
export async function syncRecipeRating(
  payload: Payload,
  recipeId: number,
): Promise<{ sum: number; count: number }> {
  const all = await payload.find({
    collection: 'ratings',
    where: { recipe: { equals: recipeId } },
    limit: 0,
    pagination: false,
    depth: 0,
  })
  let sum = 0
  for (const d of all.docs) sum += typeof d.stars === 'number' ? d.stars : 0
  const count = all.docs.length
  await payload.update({
    collection: 'recipes',
    id: recipeId,
    data: { ratingSum: sum, ratingCount: count },
  })
  return { sum, count }
}
