import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Editorial constraint tags for the authored catalog — equipment, one-pan,
 * make-ahead, and a rough per-serving cost (cents ≈ pence) — so the new catalog
 * filters have real data to bite on. Values are hand-judged per dish (the same
 * call an editor makes in /admin). Idempotent: re-running just re-sets them.
 * Run: npm run seed:constraints
 */
type Tag = { equipment: string[]; onePan: boolean; makeAhead: boolean; costPerServing: number }

const TAGS: Record<string, Tag> = {
  'bibimbap-with-gochujang-sauce': { equipment: ['stovetop'], onePan: false, makeAhead: true, costPerServing: 250 },
  'black-bean-tlayuda': { equipment: ['stovetop', 'oven'], onePan: false, makeAhead: true, costPerServing: 200 },
  'butter-chicken': { equipment: ['stovetop'], onePan: true, makeAhead: true, costPerServing: 350 },
  'cacio-e-pepe': { equipment: ['stovetop'], onePan: true, makeAhead: false, costPerServing: 150 },
  'chana-masala': { equipment: ['stovetop'], onePan: true, makeAhead: true, costPerServing: 120 },
  'charred-aubergine-with-tahini-and-pomegranate': { equipment: ['grill'], onePan: false, makeAhead: true, costPerServing: 200 },
  'chilled-soba-with-kombu-tsuyu': { equipment: ['stovetop', 'no-cook'], onePan: false, makeAhead: true, costPerServing: 200 },
  'green-curry-with-aubergine-and-thai-basil': { equipment: ['stovetop'], onePan: true, makeAhead: true, costPerServing: 300 },
  'kimchi-jjigae': { equipment: ['stovetop'], onePan: true, makeAhead: true, costPerServing: 200 },
  'mapo-tofu': { equipment: ['stovetop'], onePan: true, makeAhead: false, costPerServing: 200 },
  muhammara: { equipment: ['no-cook', 'food-processor'], onePan: false, makeAhead: true, costPerServing: 200 },
  oyakodon: { equipment: ['stovetop'], onePan: true, makeAhead: false, costPerServing: 250 },
  'pasta-e-ceci': { equipment: ['stovetop'], onePan: true, makeAhead: true, costPerServing: 120 },
  'smashed-cucumber-salad': { equipment: ['no-cook'], onePan: false, makeAhead: false, costPerServing: 100 },
  'som-tam': { equipment: ['no-cook'], onePan: false, makeAhead: false, costPerServing: 150 },
  'tacos-de-tinga': { equipment: ['stovetop'], onePan: false, makeAhead: true, costPerServing: 250 },
  'weeknight-shakshuka': { equipment: ['stovetop'], onePan: true, makeAhead: true, costPerServing: 150 },
}

async function run() {
  const payload = await getPayload({ config })
  for (const [slug, tag] of Object.entries(TAGS)) {
    const found = await payload.find({ collection: 'recipes', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
    const recipe = found.docs[0]
    if (!recipe) {
      console.log(`skip: no recipe "${slug}"`)
      continue
    }
    // Make-ahead dishes keep — give them a storage window (merge, don't clobber
    // any existing finish notes) so the "Keeps well" facet has data.
    const data: Record<string, unknown> = { ...tag }
    if (tag.makeAhead) {
      const finish = (recipe as { finish?: Record<string, unknown> }).finish ?? {}
      data.finish = { ...finish, storageDays: (finish.storageDays as number) || 3 }
    }
    await payload.update({ collection: 'recipes', id: recipe.id, data: data as never })
    console.log(`tagged ${slug}: ${tag.equipment.join('/')}${tag.onePan ? ' · one-pan' : ''}${tag.makeAhead ? ' · make-ahead/keeps' : ''} · ${tag.costPerServing}c`)
  }
  console.log('done')
  process.exit(0)
}
void run()
