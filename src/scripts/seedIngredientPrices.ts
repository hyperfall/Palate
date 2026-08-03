import 'dotenv/config'

import { getPayloadClient } from '@/lib/queries'

/**
 * Baseline shelf prices for the ingredient catalogue.
 *
 *   npm run seed:prices          # report what would change
 *   npm run seed:prices -- --apply
 *
 * WHERE THESE NUMBERS COME FROM
 *
 * UK supermarket shelf prices, researched August 2026, one product at a time.
 * Each carries the shop and pack it was read off, and that string is written to
 * the ingredient so the admin shows it beside the price — a figure nobody can
 * trace is a guess wearing a number.
 *
 * Sourcing rules, applied throughout: supermarket own-brand, standard range
 * (not organic, not finest); the ordinary shelf price rather than a Clubcard or
 * Nectar one, since a promotional price is not what the week actually costs;
 * and the pack a home cook would buy rather than a catering tub. Tesco first,
 * then Sainsbury's, ASDA, Morrisons. A handful of ingredients — gochugaru,
 * guajillo, kombu, dashi, Thai basil — are not stocked by any of them, and are
 * priced from the specialist grocer a cook would actually have to use; each
 * says so in its source string.
 *
 * These are good to within a few percent, not to the penny. The retailers block
 * automated fetches, so most were confirmed through a price aggregator, which
 * can lag the shelf by days. Groceries move anyway: `checkedAt` is stamped on
 * every row so the stale ones can be found later without re-checking all 110.
 *
 * SIX PLACES THE RESEARCHED FIGURE NEEDED A DECISION
 *
 * A product's unit and a recipe's unit are different questions, and conflating
 * them is how a tin of tomatoes came to cost £120. Where they disagreed:
 *
 *  · chicken stock is sold as cubes and used as liquid. Priced as the made-up
 *    stock (one cube per 450 ml), which is 0.024p/ml rather than the 0.3p/ml a
 *    carton of fresh stock would suggest.
 *  · dashi, the same: 40 g of powder makes about 7 litres, and every recipe
 *    here states it in ml. Costing 200 ml against the powder weight would have
 *    read £14.95 for one bowl of soup.
 *  · garlic is sold by the bulb and cooked by the clove, and the catalogue's
 *    piece for garlic IS a clove. Priced by weight (~33 g a bulb) so four
 *    cloves cost four cloves rather than four bulbs.
 *  · green papaya is sold as one ~600 g fruit and counted as one fruit, but has
 *    no per-piece weight recorded — so it is priced per piece, not per gram,
 *    or it would silently drop out of the total.
 *  · tinned chickpeas use the drained weight (240 g of a 400 g tin), because
 *    that is what a recipe uses.
 *  · kombu is left unpriced on purpose. Recipes state it as "10 cm", a length,
 *    and inventing a grams-per-strip to close the gap would be exactly the kind
 *    of confident guess this file exists to remove. The panel reports it.
 *
 * Amchur is absent for the same reason: out of stock at Tesco and inconsistent
 * everywhere else, so there is no price to record. An ingredient with no entry
 * here stays unpriced, and the recipe says so rather than pretending it is free.
 *
 * Every figure is editable per ingredient in the admin, and any signed-in
 * cook's own price overrides all of it — which is the actual feature. This is
 * the starting point, not the answer.
 */

type Unit = 'g' | 'ml' | 'piece'
/** [pence GBP, pack size, what the pack size counts, where it was read off] */
type Entry = [pence: number, amount: number, unit: Unit, source: string]

const PRICES: Record<string, Entry> = {
  // ── Spices, dried chillies and dry seasonings ─────────────────────────
  'aleppo-pepper': [399, 70, 'g', 'Sous Chef Aleppo Pepper (Pul Biber) — specialist; not stocked by the big four'],
  'ancho-chilli': [115, 27, 'g', 'Sainsbury\'s Ancho Chilli Flakes 27g'],
  'arbol-chilli': [385, 20, 'g', 'Cool Chile Co De Arbol Chillies 20g — specialist'],
  'bay-leaf': [110, 3, 'g', 'Tesco Bay Leaves 3g'],
  'bird-s-eye-chilli': [90, 25, 'g', 'Tesco Bird Eye Chillies 25g'],
  'black-peppercorn': [270, 100, 'g', 'Tesco Whole Black Peppercorns 100g'],
  'cayenne-pepper': [110, 48, 'g', 'Tesco Ground Cayenne Pepper 48g'],
  cinnamon: [110, 36, 'g', 'Tesco Ground Cinnamon 36g'],
  coriander: [110, 36, 'g', 'Tesco Ground Coriander 36g'],
  cumin: [100, 43, 'g', 'Tesco Ground Cumin 43g'],
  'fenugreek-leaf': [110, 15, 'g', 'Tesco Fenugreek Leaves 15g'],
  'garam-masala': [110, 38, 'g', 'Tesco Garam Masala 38g'],
  gochugaru: [199, 50, 'g', 'The Asian Cookshop Korean Gochugaru 50g — specialist'],
  'guajillo-chilli': [546, 75, 'g', 'Melbury & Appleton Guajillo Chillies 75g — specialist'],
  'kashmiri-chilli-powder': [110, 27, 'g', 'Tesco Kashmiri Chilli Flakes 27g'],
  oregano: [110, 14, 'g', 'Tesco Dried Oregano 14g'],
  rosemary: [110, 27, 'g', 'Tesco Dried Rosemary 27g'],
  'sichuan-peppercorn': [230, 21, 'g', 'Waitrose Cooks\' Ingredients Szechuan Pepper 21g — only own-brand source'],
  'sweet-paprika': [110, 50, 'g', 'Tesco Paprika 50g'],
  'tandoori-masala': [135, 80, 'g', 'Tesco Mild Tandoori Curry Powder 80g'],
  salt: [65, 750, 'g', 'Tesco Table Salt 750g'],
  'sea-salt-flake': [285, 250, 'g', 'Maldon Sea Salt Flakes 250g (Tesco)'],
  sugar: [109, 1000, 'g', 'Tesco Granulated Sugar 1kg'],
  cornflour: [255, 500, 'g', 'Tesco Cornflour 500g'],

  // ── Fresh produce ─────────────────────────────────────────────────────
  aubergine: [99, 1, 'piece', 'Tesco Aubergine, each'],
  avocado: [69, 1, 'piece', 'Tesco Ripe & Ready Avocado, each'],
  beansprout: [85, 300, 'g', 'Tesco Beansprouts 300g'],
  cabbage: [89, 1, 'piece', 'Tesco White Cabbage, each'],
  carrot: [10, 1, 'piece', 'Tesco Carrots loose, from 69p/kg at ~140 g each'],
  'cherry-tomato': [85, 300, 'g', 'Tesco Cherry Tomatoes 300g'],
  cilantro: [50, 30, 'g', 'Tesco Fresh Cut Coriander 30g'],
  cucumber: [99, 1, 'piece', 'Tesco Whole Cucumber, each'],
  'flat-leaf-parsley': [50, 30, 'g', 'Tesco Fresh Cut Flat Leaf Parsley 30g'],
  garlic: [88, 132, 'g', 'Tesco Garlic 4 Pack 88p — priced by weight at ~33 g a bulb, because recipes count cloves and the catalogue\'s piece is a clove'],
  ginger: [56, 100, 'g', 'Tesco Root Ginger loose, from ~£5.60/kg'],
  'green-papaya': [499, 1, 'piece', 'Veena\'s Green Papaya ~600 g — one papaya; recipes count it and the catalogue has no per-piece weight'],
  'kaffir-lime-leaf': [250, 50, 'g', 'Tuk Tuk Mart Fresh Kaffir Lime Leaves 50g — Thai specialist grocer'],
  lemon: [35, 1, 'piece', 'Tesco Large Lemons, each'],
  lime: [24, 1, 'piece', 'Tesco Limes, each'],
  'lime-juice': [120, 250, 'ml', 'Tesco Lime Juice 250ml'],
  'lime-wedge': [24, 1, 'piece', 'Tesco Limes, each'],
  onion: [95, 3, 'piece', 'Tesco Brown Onions 3 pack'],
  'pomegranate-seed': [150, 80, 'g', 'Tesco Pomegranate Seeds 80g'],
  'red-bell-pepper': [70, 1, 'piece', 'Tesco Red Peppers, each'],
  'red-pepper': [70, 1, 'piece', 'Tesco Red Peppers, each'],
  'shiitake-mushroom': [200, 125, 'g', 'Tesco Finest Shiitake Mushrooms 125g — only tier stocked; no standard-range fresh shiitake exists'],
  shiitake: [180, 40, 'g', 'Tesco Dried Shiitake Mushrooms 40g'],
  spinach: [165, 220, 'g', 'Tesco Baby Spinach 220g'],
  'spring-onion': [12, 1, 'piece', 'Tesco Bunched Spring Onions 100g at 69p, ~6 per bunch'],
  'thai-aubergine': [199, 100, 'g', 'Tuk Tuk Mart Fresh Pea Aubergine 100g — Thai specialist grocer'],
  'thai-basil': [259, 100, 'g', 'Zing Asia Fresh Thai Basil 100g — Asian specialist grocer'],
  tomato: [99, 6, 'piece', 'Tesco Classic Round Tomatoes 6 pack'],
  'white-onion': [95, 3, 'piece', 'Tesco Brown Onions 3 pack — no distinct white-onion SKU at the big four'],
  'white-onion-and-coriander': [95, 3, 'piece', 'Tesco Brown Onions 3 pack — garnish priced as one onion'],

  // ── Meat, tofu and dairy ──────────────────────────────────────────────
  'bone-marrow-disc': [390, 650, 'g', 'Morrisons British Beef Marrowbone 650g'],
  'braising-steak': [419, 400, 'g', 'Tesco Stewing Steak 400g'],
  'chicken-thigh': [595, 640, 'g', 'Sainsbury\'s British Skinless Boneless Chicken Thigh Fillets 640g'],
  egg: [180, 6, 'piece', 'Tesco Free Range Eggs Medium 6pk'],
  'firm-tofu': [290, 396, 'g', 'Cauldron Original Tofu 396g (Tesco) — no own-brand plain firm tofu at the big four'],
  pork: [249, 500, 'g', 'Tesco Lean Pork Mince 5% Fat 500g'],
  'pork-belly': [400, 500, 'g', 'Sainsbury\'s British Pork Belly Slices 500g'],
  'silken-tofu': [185, 308, 'g', 'Yutaka Silken Tofu 308g (Tesco)'],
  butter: [189, 250, 'g', 'Tesco British Salted Block Butter 250g'],
  'double-cream': [160, 300, 'ml', 'Tesco British Double Cream 300ml'],
  feta: [180, 200, 'g', 'Tesco Greek Feta Cheese 200g'],
  mozzarella: [130, 200, 'g', 'Tesco Mozzarella 200g'],
  'pecorino-romano': [400, 170, 'g', 'Tesco Italian Pecorino 170g — nearest hard Italian cheese, not PDO Romano'],
  quesillo: [130, 200, 'g', 'Tesco Mozzarella 200g — substitute; Oaxaca string cheese not stocked in UK supermarkets'],
  yoghurt: [115, 500, 'g', 'Tesco Natural Yogurt 500g'],

  // ── Oils, sauces, pastes and vinegars ─────────────────────────────────
  'chilli-crisp': [275, 210, 'g', 'Laoganma Crispy Chilli in Oil 210g (Sainsbury\'s)'],
  'chinkiang-black-vinegar': [180, 550, 'ml', 'FU XING Chinkiang Vinegar 550ml (Longdan) — online Asian grocer'],
  'chipotles-in-adobo': [299, 199, 'g', 'La Costena Chipotle in Adobo 199g (Ocado) — no big-four stockist'],
  doubanjiang: [220, 195, 'g', 'Lee Kum Kee Chilli Bean Sauce 195g (Tesco)'],
  'fish-sauce': [185, 200, 'ml', 'Thai Dragon Fish Sauce 200ml (Tesco)'],
  gochujang: [180, 90, 'g', 'Tesco Gochujang Paste 90g'],
  'green-curry-paste': [180, 200, 'g', 'Tesco Green Thai Curry Paste 200g'],
  honey: [119, 340, 'g', 'Tesco Squeezy Clear Honey 340g'],
  mirin: [210, 150, 'ml', 'Yutaka Japanese Mirin 150ml (Sainsbury\'s)'],
  'olive-oil': [675, 1000, 'ml', 'Tesco Olive Oil 1L'],
  'palm-sugar': [265, 200, 'g', 'Thai Taste Palm Sugar 200g (Tesco)'],
  'pomegranate-molasses': [380, 250, 'ml', 'Odysea Pomegranate Molasses 250ml (Sainsbury\'s)'],
  'sesame-oil': [265, 250, 'ml', 'Tesco Toasted Sesame Oil 250ml'],
  'soy-sauce': [55, 150, 'ml', 'Tesco Light Soy Sauce 150ml'],
  'sunflower-oil': [195, 1000, 'ml', 'Tesco Pure Sunflower Oil 1L'],
  tahini: [310, 300, 'g', 'Tesco Tahini 300g'],
  'white-wine-vinegar': [155, 350, 'ml', 'Tesco White Wine Vinegar 350ml'],

  // ── Tins, jars and stocks ─────────────────────────────────────────────
  'chicken-stock': [110, 4500, 'ml', 'Tesco 10 Chicken Stock Cubes — 1 cube per 450ml, so 10 cubes make 4.5L'],
  chickpea: [49, 240, 'g', 'Sainsbury\'s Chickpeas in Water 400g (240g drained)'],
  'coconut-milk': [75, 400, 'ml', 'Tesco Coconut Milk 400ml'],
  dashi: [299, 7000, 'ml', 'Hondashi Instant Dashi 40 g (Sous Chef) — converted to made-up stock at ~1 g per 175 ml, because recipes state dashi in ml'],
  kimchi: [350, 200, 'g', 'Yutaka Korean Kimchi 200g (Tesco) — no own-brand kimchi exists'],
  kombu: [549, 40, 'g', 'Clearspring Hokkaido Kombu 40g — not a UK supermarket item'],
  passata: [45, 500, 'g', 'Tesco Tomato Passata 500g'],
  'refried-black-bean': [210, 392, 'g', 'Tesco Refried Beans 392g'],
  salsa: [95, 290, 'g', 'Tesco Mild Salsa Topping 290g'],
  'spicy-salsa': [150, 300, 'g', 'Sainsbury\'s Hot Salsa Dip 300g'],
  'tomato-puree': [59, 200, 'g', 'Tesco Tomato Puree 200g tube'],
  wasabi: [175, 43, 'g', 'S&B Wasabi Paste 43g (Sainsbury\'s)'],

  // ── Grains, pasta and dry goods ───────────────────────────────────────
  breadcrumb: [120, 175, 'g', 'Tesco White Breadcrumbs 175g'],
  'corn-tortilla': [137, 8, 'piece', 'ASDA 8 Corn Tortillas 320g'],
  ditalini: [69, 500, 'g', 'Tesco Penne 500g — substitute; ditalini not stocked by the big four'],
  rice: [179, 1000, 'g', 'Tesco Basmati Rice 1kg'],
  'sesame-seed': [120, 100, 'g', 'Tesco Sesame Seeds 100g'],
  'short-grain-rice': [225, 500, 'g', 'Tesco Sushi Rice 500g'],
  soba: [150, 250, 'g', 'Yutaka Soba Noodles 250g (Sainsbury\'s) — no own-brand soba exists'],
  tonnarelli: [70, 500, 'g', 'Tesco Quick Cook Spaghetti 500g — substitute; tonnarelli not stocked by the big four'],
  walnut: [225, 200, 'g', 'Tesco Walnuts 200g'],
  water: [0, 1000, 'ml', 'UK mains water at ~£1.75/m3 — rounds to zero, which is correct'],
}

/**
 * What kind of thing each ingredient is.
 *
 * Every one of the 109 was sitting on the default 'other', which made the
 * field useless — it could not group a shopping list, filter a catalogue, or
 * pick a stand-in tile for an ingredient with no photograph yet. These come
 * from the same grouping the price research was organised by, so they are a
 * by-product of work already done rather than a fresh guess.
 */
type Category = NonNullable<import('@/payload-types').Ingredient['category']>

const CATEGORIES: Partial<Record<Category, string[]>> = {
  'condiment': [
    'chicken-stock', 'chilli-crisp', 'chinkiang-black-vinegar', 'chipotles-in-adobo',
    'coconut-milk', 'dashi', 'doubanjiang', 'fish-sauce', 'gochujang', 'green-curry-paste',
    'honey', 'kimchi', 'kombu', 'mirin', 'palm-sugar', 'passata', 'pomegranate-molasses',
    'salsa', 'soy-sauce', 'spicy-salsa', 'tahini', 'tomato-puree', 'wasabi',
    'white-wine-vinegar',
  ],
  'dairy': [
    'butter', 'double-cream', 'feta', 'mozzarella', 'pecorino-romano', 'quesillo',
    'yoghurt',
  ],
  'grain-legume': [
    'breadcrumb', 'chickpea', 'corn-tortilla', 'cornflour', 'ditalini',
    'refried-black-bean', 'rice', 'sesame-seed', 'short-grain-rice', 'soba', 'sugar',
    'tonnarelli', 'walnut', 'water',
  ],
  'oil-fat': [
    'olive-oil', 'sesame-oil', 'sunflower-oil',
  ],
  'produce': [
    'aubergine', 'avocado', 'beansprout', 'cabbage', 'carrot', 'cherry-tomato', 'cilantro',
    'cucumber', 'flat-leaf-parsley', 'garlic', 'ginger', 'green-papaya', 'kaffir-lime-leaf',
    'lemon', 'lime', 'lime-juice', 'lime-wedge', 'onion', 'pomegranate-seed',
    'red-bell-pepper', 'red-pepper', 'shiitake', 'shiitake-mushroom', 'spinach',
    'spring-onion', 'thai-aubergine', 'thai-basil', 'tomato', 'white-onion',
    'white-onion-and-coriander',
  ],
  'protein': [
    'bone-marrow-disc', 'braising-steak', 'chicken-thigh', 'egg', 'firm-tofu', 'pork',
    'pork-belly', 'silken-tofu',
  ],
  'spice-herb': [
    'aleppo-pepper', 'amchur', 'ancho-chilli', 'arbol-chilli', 'bay-leaf',
    'bird-s-eye-chilli', 'black-peppercorn', 'cayenne-pepper', 'cinnamon', 'coriander',
    'cumin', 'fenugreek-leaf', 'garam-masala', 'gochugaru', 'guajillo-chilli',
    'kashmiri-chilli-powder', 'oregano', 'rosemary', 'salt', 'sea-salt-flake',
    'sichuan-peppercorn', 'sweet-paprika', 'tandoori-masala',
  ],
}

const CATEGORY_BY_SLUG = new Map<string, Category>(
  Object.entries(CATEGORIES).flatMap(([category, slugs]) =>
    slugs.map((s) => [s, category as Category] as const),
  ),
)

/**
 * Per-piece weights for things a recipe counts but a shop sells by weight.
 *
 * Without these the row is honestly unpriceable, which is correct behaviour but
 * a poor answer when the number is knowable. Both are averages, and both make
 * the nutrition estimate work too, since it goes through the same conversion.
 */
const GRAMS_PER_PIECE: Record<string, number> = {
  'chicken-thigh': 90,
  'kaffir-lime-leaf': 0.4,
}

/**
 * Prices to actively REMOVE.
 *
 * An earlier version of this file carried invented estimates for the whole
 * catalogue. Research replaced them — except here, where research came back
 * with nothing verifiable. Leaving the old number in place would be the worst
 * of both: a fabricated figure that now looks researched because everything
 * around it is. Clearing it makes the recipe say "no price yet", which is true.
 */
const UNVERIFIED: Record<string, string> = {
  amchur: 'Out of stock at Tesco; specialist listings gave contradictory pack sizes and prices.',
}

const apply = process.argv.includes('--apply')
const checkedAt = process.env.PRICE_CHECKED_AT ?? '2026-08-03'

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
let weights = 0
let categorised = 0
const missing = new Set(slugs)

for (const doc of found.docs as unknown as Array<Record<string, unknown>>) {
  const slug = String(doc.slug)
  missing.delete(slug)
  const [packPrice, packAmount, packUnit, source] = PRICES[slug]
  const current = (doc.price ?? {}) as Record<string, unknown>
  const gpp = GRAMS_PER_PIECE[slug]
  const needsWeight = gpp != null && doc.gramsPerPiece == null
  const category = CATEGORY_BY_SLUG.get(slug)
  const needsCategory = category != null && doc.category !== category

  const same =
    current.packPrice === packPrice &&
    current.packAmount === packAmount &&
    current.packUnit === packUnit &&
    current.source === source

  if (same && !needsWeight && !needsCategory) {
    unchanged++
    continue
  }
  if (apply) {
    await payload.update({
      collection: 'ingredients',
      id: doc.id as number,
      data: {
        price: { packPrice, packAmount, packUnit, source, checkedAt },
        ...(needsWeight ? { gramsPerPiece: gpp } : {}),
        ...(needsCategory ? { category } : {}),
      },
      depth: 0,
    })
  }
  if (needsWeight) weights++
  if (needsCategory) categorised++
  if (!same) wrote++
}

let cleared = 0
for (const [slug, why] of Object.entries(UNVERIFIED)) {
  const doc = await payload.find({
    collection: 'ingredients',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
  })
  const hit = doc.docs[0] as unknown as Record<string, unknown> | undefined
  if (!hit) continue
  const price = (hit.price ?? {}) as Record<string, unknown>
  const wantCategory = CATEGORY_BY_SLUG.get(slug)
  const categoryWrong = wantCategory != null && hit.category !== wantCategory
  // Already cleared AND already categorised: nothing left to do.
  if (price.packPrice == null && price.packAmount == null && !categoryWrong) continue
  if (apply) {
    await payload.update({
      collection: 'ingredients',
      id: hit.id as number,
      data: {
        price: {
          packPrice: null,
          packAmount: null,
          packUnit: null,
          source: `No verifiable price: ${why}`,
          checkedAt,
        },
        // Still categorise it. An ingredient with no price is exactly the one a
        // cook is most likely to go looking for, so it should not also be the
        // one drawn as the generic fallback tile.
        ...(wantCategory ? { category: wantCategory } : {}),
      },
      depth: 0,
    })
  }
  cleared++
}

console.log('')
console.log(`Baseline prices — ${apply ? 'applied' : 'dry run'}`)
console.log(`  priced          ${wrote}`)
console.log(`  already correct ${unchanged}`)
if (weights) console.log(`  per-piece weights added ${weights}`)
if (categorised) console.log(`  categorised       ${categorised}`)
if (cleared) console.log(`  cleared as unverifiable ${cleared}`)
if (missing.size) {
  console.log(`  no such ingredient (${missing.size}): ${[...missing].join(', ')}`)
}

// The catalogue is what has to be covered, not this table — an ingredient
// nobody priced is the one that makes a recipe read "partly priced".
const all = await payload.find({ collection: 'ingredients', depth: 0, limit: 1000 })
const unpriced = (all.docs as unknown as Array<Record<string, unknown>>).filter((d) => {
  const p = (d.price ?? {}) as Record<string, unknown>
  return p.packPrice == null || p.packAmount == null || !p.packUnit
})
console.log('')
console.log(`  catalogue       ${all.totalDocs} ingredients, ${unpriced.length} still unpriced`)
if (unpriced.length && unpriced.length <= 40) {
  console.log(`  unpriced:       ${unpriced.map((d) => d.slug).join(', ')}`)
}
if (!apply) console.log('\nNothing written. Re-run with --apply.')
console.log('')
process.exit(0)
