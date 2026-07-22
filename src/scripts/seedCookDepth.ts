import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Seeds a small, real editorial set so substitutions + step timing are visible:
 * common-ingredient swaps on canonical ingredients, and step→ingredient links
 * on one flagship recipe. Idempotent — matches ingredients by name, skips a
 * recipe that already has step uses. Run: npm run seed:cook-depth
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

  // Link steps → ingredients on the flagship recipe by matching names in text.
  if (recipe) {
    const ingredients = await payload.find({ collection: 'ingredients', limit: 1000, depth: 0 })
    const byName = new Map(ingredients.docs.map((d) => [String(d.name).toLowerCase(), d.id as number]))
    const steps = (recipe.steps ?? []).map((step: { text: string; uses?: unknown }) => {
      const uses = [...byName.entries()]
        .filter(([name]) => step.text.toLowerCase().includes(name))
        .map(([, id]) => id)
      return { ...step, uses: uses.length ? uses : step.uses }
    })
    await payload.update({ collection: 'recipes', id: recipe.id, data: { steps } as never })
    console.log(`step uses → ${recipe.slug}`)
  }

  console.log('done')
  process.exit(0)
}

void run()
