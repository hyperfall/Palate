import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Seeds a small, real editorial set so substitutions + step timing are visible:
 * common-ingredient swaps on canonical ingredients, and step→ingredient links
 * on one flagship recipe. Idempotent by construction — every write fully
 * replaces its array field (no appends), and both the substitution match and
 * the step→ingredient linking are scoped to Weeknight Shakshuka's OWN linked
 * ingredients, never a global catalog scan. Run: npm run seed:cook-depth
 */
const SUBS: Record<string, Array<{ subText: string; kind: 'flavor' | 'texture' | 'cupboard'; ratio?: string; note?: string }>> = {
  'olive oil': [
    { subText: 'avocado oil', kind: 'flavor', ratio: '1:1', note: 'neutral, high smoke point' },
    { subText: 'butter', kind: 'texture', ratio: '1:1', note: 'richer, lower smoke point' },
    { subText: 'any neutral oil', kind: 'cupboard', ratio: '1:1' },
  ],
  garlic: [
    { subText: 'garlic granules', kind: 'cupboard', ratio: '1 clove ≈ ⅛ tsp' },
    { subText: 'shallot', kind: 'flavor', note: 'milder, sweeter' },
  ],
  feta: [
    { subText: 'goat cheese', kind: 'flavor', ratio: '1:1' },
    { subText: 'ricotta salata', kind: 'texture', ratio: '1:1' },
    { subText: 'crumbled paneer + salt', kind: 'cupboard' },
  ],
  cumin: [{ subText: 'ground coriander', kind: 'flavor', note: 'earthier, less warm' }],
}

async function run() {
  const payload = await getPayload({ config })

  // Load the flagship recipe first (depth 1 populates ingredients[].ingredient
  // as full docs) so substitutions can be scoped to ingredients this recipe
  // actually links to — structural, not a coincidence of naming.
  const recipes = await payload.find({ collection: 'recipes', where: { slug: { equals: 'weeknight-shakshuka' } }, limit: 1, depth: 1 })
  const recipe = recipes.docs[0]

  const recipeIngredients = new Map<number, string>()
  if (recipe) {
    for (const row of (recipe.ingredients ?? []) as Array<{ ingredient?: number | { id: number; name: string } | null }>) {
      const ing = row.ingredient
      if (ing && typeof ing === 'object' && 'id' in ing) recipeIngredients.set(ing.id, String(ing.name))
    }
  }

  for (const [name, substitutions] of Object.entries(SUBS)) {
    // Canonical ingredient names may carry leftover quantities/units from an
    // earlier normalization pass (e.g. "tbsp olive oil"), so match by
    // case-insensitive contains rather than exact equality — but only among
    // ingredients Weeknight Shakshuka itself links to. Scoping to the
    // recipe's own ingredients (rather than a global catalog scan) guarantees
    // the subs land on an ingredient that actually renders on that page,
    // even if the catalog later gains a bare "olive oil"/"garlic" entry.
    const candidates = [...recipeIngredients.entries()].filter(([, ingName]) => ingName.toLowerCase().includes(name.toLowerCase()))
    const match = candidates.sort((a, b) => a[1].length - b[1].length)[0]
    if (!match) {
      console.log(`skip subs: no recipe-linked ingredient matching "${name}" on weeknight-shakshuka`)
      continue
    }
    const [id, matchedName] = match
    await payload.update({ collection: 'ingredients', id, data: { substitutions } as never })
    console.log(`subs → ${name} (matched "${matchedName}")`)
  }

  // Link steps → ingredients by matching names in step text — but only among
  // ingredients THIS recipe uses, so a step can never link something the recipe
  // doesn't contain (and no global catalog scan).
  if (recipe) {
    const steps = (recipe.steps ?? []).map((step: { text: string; uses?: unknown }) => {
      const uses = [...recipeIngredients.entries()]
        .filter(([, ingName]) => step.text.toLowerCase().includes(ingName.toLowerCase()))
        .map(([id]) => id)
      return { ...step, uses: uses.length ? uses : step.uses }
    })
    await payload.update({ collection: 'recipes', id: recipe.id, data: { steps } as never })
    console.log(`step uses → ${recipe.slug}`)
  }

  console.log('done')
  process.exit(0)
}

void run()
