import 'dotenv/config'

import { getPayloadClient } from '@/lib/queries'

/**
 * Baseline shelf prices for the ingredient catalogue.
 *
 *   npm run seed:prices          # report what would change
 *   npm run seed:prices -- --apply
 *
 * READ THIS BEFORE TRUSTING THE NUMBERS.
 *
 * These are rough UK supermarket estimates, typed from general knowledge of
 * what a pack costs. They are NOT researched, NOT sourced from any retailer,
 * and NOT current. They exist so a signed-out visitor sees a working cost
 * panel instead of an empty one, and so the feature can be demonstrated at
 * all — every one of them is a placeholder for a real number.
 *
 * They are safe to be wrong in a way the old costPerServing was not, for two
 * reasons. Every one is editable per ingredient in the admin, so correcting a
 * price is a field edit rather than a re-guess of a whole recipe. And a signed-
 * in cook's own price always wins over this, which is the actual feature — our
 * estimate of their shop is worth less than their receipt.
 *
 * Prices are pence, GBP, and the pack is the size you would actually buy:
 * [pence, packSize, unit]. Where a thing is bought by the item — an onion, a
 * lime, an egg — the unit is 'piece' and no weight is needed.
 *
 * Anything absent from this table stays unpriced, and the panel says so rather
 * than pretending it is free.
 */

type Unit = 'g' | 'ml' | 'piece'
type Entry = [pence: number, amount: number, unit: Unit]

const PRICES: Record<string, Entry> = {
  // ── Spices and dried chillies (small jars and packets) ───────────────────
  'aleppo-pepper': [250, 50, 'g'],
  amchur: [200, 100, 'g'],
  'ancho-chilli': [300, 50, 'g'],
  'arbol-chilli': [250, 50, 'g'],
  'bay-leaf': [120, 10, 'g'],
  'bird-s-eye-chilli': [150, 20, 'g'],
  'black-peppercorn': [200, 100, 'g'],
  'cayenne-pepper': [150, 40, 'g'],
  cinnamon: [150, 40, 'g'],
  coriander: [120, 40, 'g'],
  cumin: [120, 40, 'g'],
  'fenugreek-leaf': [200, 25, 'g'],
  'garam-masala': [150, 50, 'g'],
  gochugaru: [350, 200, 'g'],
  'guajillo-chilli': [300, 50, 'g'],
  'kashmiri-chilli-powder': [200, 100, 'g'],
  oregano: [120, 20, 'g'],
  rosemary: [120, 20, 'g'],
  'sichuan-peppercorn': [300, 50, 'g'],
  'sweet-paprika': [130, 50, 'g'],
  'tandoori-masala': [180, 80, 'g'],
  salt: [60, 750, 'g'],
  'sea-salt-flake': [250, 250, 'g'],
  sugar: [120, 1000, 'g'],
  cornflour: [90, 250, 'g'],

  // ── Fresh produce ────────────────────────────────────────────────────────
  aubergine: [90, 1, 'piece'],
  avocado: [90, 1, 'piece'],
  beansprout: [90, 300, 'g'],
  cabbage: [100, 1, 'piece'],
  carrot: [20, 1, 'piece'],
  'cherry-tomato': [180, 300, 'g'],
  cilantro: [70, 30, 'g'],
  cucumber: [75, 1, 'piece'],
  'flat-leaf-parsley': [70, 30, 'g'],
  garlic: [30, 1, 'piece'],
  ginger: [200, 100, 'g'],
  'green-papaya': [300, 1, 'piece'],
  'kaffir-lime-leaf': [200, 10, 'g'],
  lemon: [30, 1, 'piece'],
  lime: [30, 1, 'piece'],
  'lime-juice': [200, 250, 'ml'],
  'lime-wedge': [30, 1, 'piece'],
  onion: [20, 1, 'piece'],
  'pomegranate-seed': [250, 150, 'g'],
  'red-bell-pepper': [70, 1, 'piece'],
  'red-pepper': [70, 1, 'piece'],
  'shiitake-mushroom': [250, 150, 'g'],
  shiitake: [250, 150, 'g'],
  spinach: [150, 200, 'g'],
  'spring-onion': [15, 1, 'piece'],
  'thai-aubergine': [250, 200, 'g'],
  'thai-basil': [100, 30, 'g'],
  tomato: [30, 1, 'piece'],
  'white-onion': [25, 1, 'piece'],
  'white-onion-and-coriander': [50, 1, 'piece'],

  // ── Meat, fish and tofu ──────────────────────────────────────────────────
  'bone-marrow-disc': [300, 200, 'g'],
  'braising-steak': [900, 500, 'g'],
  'chicken-thigh': [350, 500, 'g'],
  egg: [300, 12, 'piece'],
  'firm-tofu': [180, 280, 'g'],
  pork: [500, 500, 'g'],
  'pork-belly': [600, 500, 'g'],
  'silken-tofu': [150, 300, 'g'],

  // ── Dairy ────────────────────────────────────────────────────────────────
  butter: [250, 250, 'g'],
  'double-cream': [150, 300, 'ml'],
  feta: [200, 200, 'g'],
  mozzarella: [150, 125, 'g'],
  'pecorino-romano': [350, 200, 'g'],
  quesillo: [400, 250, 'g'],
  yoghurt: [120, 500, 'g'],

  // ── Oils, sauces, pastes and vinegars ────────────────────────────────────
  'chilli-crisp': [500, 200, 'g'],
  'chinkiang-black-vinegar': [300, 300, 'ml'],
  'chipotles-in-adobo': [200, 200, 'g'],
  doubanjiang: [350, 200, 'g'],
  'fish-sauce': [250, 300, 'ml'],
  gochujang: [350, 500, 'g'],
  'green-curry-paste': [200, 110, 'g'],
  honey: [300, 340, 'g'],
  mirin: [300, 250, 'ml'],
  'olive-oil': [500, 500, 'ml'],
  'palm-sugar': [250, 200, 'g'],
  'pomegranate-molasses': [300, 250, 'ml'],
  'sesame-oil': [300, 250, 'ml'],
  'soy-sauce': [200, 250, 'ml'],
  'sunflower-oil': [200, 1000, 'ml'],
  tahini: [350, 300, 'g'],
  'white-wine-vinegar': [120, 500, 'ml'],

  // ── Tins, jars and stocks ────────────────────────────────────────────────
  'chicken-stock': [150, 500, 'ml'],
  chickpea: [60, 400, 'g'],
  'coconut-milk': [120, 400, 'ml'],
  dashi: [300, 100, 'g'],
  kimchi: [350, 500, 'g'],
  kombu: [400, 50, 'g'],
  passata: [80, 500, 'g'],
  'refried-black-bean': [150, 400, 'g'],
  salsa: [200, 300, 'g'],
  'spicy-salsa': [200, 300, 'g'],
  'tomato-puree': [90, 200, 'g'],
  wasabi: [250, 45, 'g'],

  // ── Grains, pasta and dry goods ──────────────────────────────────────────
  breadcrumb: [100, 200, 'g'],
  'corn-tortilla': [150, 12, 'piece'],
  ditalini: [120, 500, 'g'],
  rice: [200, 1000, 'g'],
  'sesame-seed': [150, 100, 'g'],
  'short-grain-rice': [300, 1000, 'g'],
  soba: [250, 250, 'g'],
  tonnarelli: [200, 500, 'g'],
  walnut: [300, 200, 'g'],

  // Tap water is free, and saying so is not the same as failing to price it —
  // a stock or a soup that came back "partly priced" because of the water
  // would send a cook looking for a number that does not exist.
  water: [0, 1000, 'ml'],
}

const apply = process.argv.includes('--apply')

const payload = await getPayloadClient()
const slugs = Object.keys(PRICES)
const found = await payload.find({
  collection: 'ingredients',
  where: { slug: { in: slugs } },
  depth: 0,
  limit: 500,
})

let wrote = 0
let unchanged = 0
const missing = new Set(slugs)

for (const doc of found.docs as Array<Record<string, unknown>>) {
  const slug = String(doc.slug)
  missing.delete(slug)
  const [packPrice, packAmount, packUnit] = PRICES[slug]
  const current = (doc.price ?? {}) as Record<string, unknown>
  if (
    current.packPrice === packPrice &&
    current.packAmount === packAmount &&
    current.packUnit === packUnit
  ) {
    unchanged++
    continue
  }
  if (apply) {
    await payload.update({
      collection: 'ingredients',
      id: doc.id as number,
      data: { price: { packPrice, packAmount, packUnit } },
      depth: 0,
    })
  }
  wrote++
}

console.log('')
console.log(`Baseline prices — ${apply ? 'applied' : 'dry run'}`)
console.log(`  priced        ${wrote}`)
console.log(`  already set   ${unchanged}`)
if (missing.size) {
  console.log(`  no such ingredient (${missing.size}): ${[...missing].join(', ')}`)
}

// The catalogue is the thing that has to be covered, not this table — an
// ingredient nobody priced is the one that makes a recipe read "partly priced".
const all = await payload.find({ collection: 'ingredients', depth: 0, limit: 1000 })
const unpriced = (all.docs as Array<Record<string, unknown>>).filter((d) => {
  const p = (d.price ?? {}) as Record<string, unknown>
  return p.packPrice == null || p.packAmount == null || !p.packUnit
})
console.log('')
console.log(`  catalogue     ${all.totalDocs} ingredients, ${unpriced.length} still unpriced`)
if (unpriced.length && unpriced.length <= 40) {
  console.log(`  unpriced:     ${unpriced.map((d) => d.slug).join(', ')}`)
}
if (!apply) console.log('\nNothing written. Re-run with --apply.')
console.log('')
process.exit(0)
