import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * One-off: drop demo mise-en-place pins on the shakshuka hero so the annotated
 * hero can be verified end to end. Safe to re-run — it overwrites the array.
 * `node --import=tsx/esm src/scripts/seedHeroPins.ts`
 */
const payload = await getPayload({ config })
const found = await payload.find({
  collection: 'recipes',
  where: { slug: { equals: 'weeknight-shakshuka' } },
  limit: 1,
  depth: 0,
})
const recipe = found.docs[0]
if (!recipe) {
  console.error('weeknight-shakshuka not found')
  process.exit(1)
}

const heroAnnotations = [
  { x: 48, y: 42, kicker: 'Yolk', note: 'Pull at 6 min — jammy, not set.' },
  { x: 30, y: 68, kicker: 'Base', note: 'Harissa-spiked tomato, reduced thick.' },
  { x: 72, y: 22, kicker: 'Off heat', note: 'Torn parsley to finish.' },
]

await payload.update({
  collection: 'recipes',
  id: recipe.id,
  data: { heroAnnotations } as never,
})
console.log(`✓ seeded ${heroAnnotations.length} pins on ${recipe.title}`)
process.exit(0)
