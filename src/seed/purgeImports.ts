import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Retires the API era: deletes every `provenance: api-imported` recipe and
 * the importer author entities. Authored/community recipes and all media are
 * untouched (cuisine hub photos keep working). One-way door — run on purpose.
 *
 *   npm run purge:imports
 */
const payload = await getPayload({ config })

let purged = 0
for (;;) {
  const batch = await payload.find({
    collection: 'recipes',
    where: { provenance: { equals: 'api-imported' } },
    depth: 0,
    limit: 100,
  })
  if (batch.docs.length === 0) break
  for (const recipe of batch.docs) {
    await payload.delete({ collection: 'recipes', id: recipe.id })
    purged++
  }
}

for (const slug of ['spoonacular', 'edamam', 'themealdb']) {
  const author = await payload.find({
    collection: 'authors',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (author.docs[0]) {
    await payload.delete({ collection: 'authors', id: author.docs[0].id })
  }
}

console.log(`Purged ${purged} API-imported recipes. The catalog is yours now.`)
process.exit(0)
