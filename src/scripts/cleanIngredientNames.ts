import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { normalizeItem } from '../lib/ingredients/normalize'
import { slugify } from '../fields/slug'

/**
 * One-off cleanup for canonical ingredient names that carry a leftover unit/
 * quantity prefix ("tbsp olive oil", "g can tomato") — created before
 * normalizeItem stripped leading units. For each dirty row it computes the
 * clean name (to a fixpoint, so "g can tomato" → "tomato") and either:
 *   - RENAME in place if no clean-named canonical exists, or
 *   - MERGE into the existing clean canonical: re-point every recipe's
 *     `ingredients[].ingredient` and `steps[].uses` FK from the dirty id to the
 *     clean id, move substitutions over if the target has none, then delete the
 *     dirty row.
 * Idempotent: a second run finds nothing dirty. Run: npm run clean:ingredients
 */
const relId = (v: unknown): number | undefined =>
  typeof v === 'object' && v ? (v as { id: number }).id : (v as number | undefined) ?? undefined

/** Apply normalizeItem repeatedly until stable — peels a chain like "g can tomato". */
function canonicalName(name: string): string {
  let prev = name
  let next = normalizeItem(name)
  while (next && next !== prev) {
    prev = next
    next = normalizeItem(next)
  }
  return next || name
}

async function run() {
  const payload = await getPayload({ config })
  const all = await payload.find({ collection: 'ingredients', limit: 1000, depth: 0 })

  // Map clean name → id for every ingredient already at its canonical form.
  const cleanByName = new Map<string, number>()
  for (const doc of all.docs) {
    const name = String(doc.name)
    if (canonicalName(name) === name.toLowerCase()) cleanByName.set(name.toLowerCase(), doc.id as number)
  }

  const dirty = all.docs.filter((d) => {
    const clean = canonicalName(String(d.name))
    return clean && clean !== String(d.name).toLowerCase()
  })

  if (dirty.length === 0) {
    console.log('nothing to clean — all ingredient names are canonical')
    process.exit(0)
  }

  for (const doc of dirty) {
    const id = doc.id as number
    const clean = canonicalName(String(doc.name))
    const targetId = cleanByName.get(clean)

    if (targetId && targetId !== id) {
      // MERGE dirty → target.
      await repoint(payload, id, targetId)
      // Move substitutions over only if the target has none of its own.
      const target = await payload.findByID({ collection: 'ingredients', id: targetId, depth: 0 })
      const dirtySubs = (doc as { substitutions?: unknown[] }).substitutions
      const targetSubs = (target as { substitutions?: unknown[] }).substitutions
      if (Array.isArray(dirtySubs) && dirtySubs.length && !(Array.isArray(targetSubs) && targetSubs.length)) {
        await payload.update({ collection: 'ingredients', id: targetId, data: { substitutions: dirtySubs } as never })
      }
      await payload.delete({ collection: 'ingredients', id })
      console.log(`merge "${doc.name}" (${id}) → "${clean}" (${targetId})`)
    } else {
      // RENAME in place.
      await payload.update({
        collection: 'ingredients',
        id,
        data: { name: clean, slug: slugify(clean) } as never,
      })
      cleanByName.set(clean, id)
      console.log(`rename "${doc.name}" (${id}) → "${clean}"`)
    }
  }

  console.log('done')
  process.exit(0)
}

/** Re-point every recipe FK referencing `fromId` to `toId` (ingredient links + step uses). */
async function repoint(payload: Awaited<ReturnType<typeof getPayload>>, fromId: number, toId: number) {
  const byIngredient = await payload.find({
    collection: 'recipes',
    where: { 'ingredients.ingredient': { equals: fromId } },
    limit: 1000,
    depth: 0,
  })
  for (const r of byIngredient.docs) {
    const ingredients = ((r.ingredients ?? []) as Array<Record<string, unknown>>).map((row) =>
      relId(row.ingredient) === fromId ? { ...row, ingredient: toId } : row,
    )
    await payload.update({ collection: 'recipes', id: r.id, data: { ingredients } as never })
  }

  const bySteps = await payload.find({
    collection: 'recipes',
    where: { 'steps.uses': { equals: fromId } },
    limit: 1000,
    depth: 0,
  })
  for (const r of bySteps.docs) {
    const steps = ((r.steps ?? []) as Array<Record<string, unknown>>).map((step) => ({
      ...step,
      uses: Array.isArray(step.uses)
        ? (step.uses as unknown[]).map((u) => (relId(u) === fromId ? toId : relId(u)))
        : step.uses,
    }))
    await payload.update({ collection: 'recipes', id: r.id, data: { steps } as never })
  }
}

void run()
