/**
 * "Cooked alongside": which ingredients keep company with a given one.
 *
 * Counted from the recipes themselves rather than authored by hand — the
 * ingredient backbone is what makes the question answerable at all. Kept pure
 * and separate from the query that feeds it so the counting rules can be
 * tested without a database.
 */

/** The minimum shape this needs; the real Payload docs carry far more. */
export type PairingRecipe = {
  ingredients?: Array<{ ingredient?: unknown }> | null
}

export type Pairing = { id: number; name: string; slug: string; count: number }

/**
 * Tally co-occurrences across recipes.
 *
 * One vote per recipe per ingredient: a recipe that lists an item twice ("half
 * now, half to finish") must not count double, or a single recipe could
 * outrank a genuinely common pairing. The subject itself never pairs with
 * itself, and rows with no canonical link are skipped — an unlinked row is a
 * string, not an ingredient, and can't be pointed at a page.
 *
 * Ordered by count, then alphabetically so equal counts are stable rather than
 * dependent on database row order.
 */
export function tallyPairings(
  recipes: PairingRecipe[],
  subjectId: number,
  limit = 12,
): Pairing[] {
  const tally = new Map<number, Pairing>()

  for (const recipe of recipes) {
    const seen = new Set<number>()
    for (const row of recipe.ingredients ?? []) {
      const ing = row?.ingredient
      if (!ing || typeof ing !== 'object') continue
      const { id, name, slug } = ing as { id?: unknown; name?: unknown; slug?: unknown }
      if (typeof id !== 'number' || typeof slug !== 'string' || !slug) continue
      if (id === subjectId || seen.has(id)) continue
      seen.add(id)
      const entry = tally.get(id) ?? { id, name: String(name ?? slug), slug, count: 0 }
      entry.count += 1
      tally.set(id, entry)
    }
  }

  return [...tally.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}
