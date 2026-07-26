import 'dotenv/config'
import { createReadStream } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { getPayload } from 'payload'
import config from '@payload-config'

import { normalizeItem, singularize } from '../lib/ingredients/normalize'

/**
 * Build `src/data/usdaNutrition.json` — per-100g nutrition for every canonical
 * ingredient, matched against the USDA SR Legacy dataset (public domain, CC0).
 *
 * This replaces hand-typing nutrition values: the numbers come from the actual
 * USDA CSVs, matched offline, committed to the repo, and reviewed via the report
 * this script prints. Nothing here runs at request time — `seed:nutrition`
 * copies the committed JSON onto the canonical ingredients.
 *
 * Usage (SR Legacy CSVs unzipped anywhere):
 *   npm run build:usda -- /path/to/FoodData_Central_sr_legacy_food_csv_2018-04
 *
 * Matching is deliberately conservative — an unmatched ingredient stays
 * unmatched and appears in the report (extend ALIASES and re-run) rather than
 * silently linking to the wrong food. Mis-linked nutrition is worse than none.
 */

const NUTRIENT_IDS = {
  kcal: '1008',
  protein: '1003',
  carbs: '1005',
  fat: '1004',
  saturates: '1258',
  sugars: '2000',
  fibre: '1079',
  sodiumMg: '1093',
} as const

/** Canonical name → the SR Legacy description head to prefer. Grown from the
 *  script's own unmatched report; keep alphabetical. */
const ALIASES: Record<string, string> = {
  'aleppo pepper': 'Spices, pepper, red or cayenne',
  'ancho chilli': 'Peppers, ancho, dried',
  'arbol chilly': 'Peppers, ancho, dried',
  aubergine: 'Eggplant, raw',
  'basmati rice': 'Rice, white, long-grain, regular, raw, unenriched',
  'bay leaf': 'Spices, bay leaf',
  'bay leave': 'Spices, bay leaf',
  beansprout: 'Mung beans, mature seeds, sprouted, raw',
  'birds eye chilli': 'Peppers, hot chili, red, raw',
  'bird s eye chilly': 'Peppers, hot chili, red, raw',
  'black peppercorn': 'Spices, pepper, black',
  'braising steak': 'Beef, chuck, arm pot roast, separable lean and fat, trimmed to 1/8" fat, all grades, raw',
  breadcrumb: 'Bread, crumbs, dry, grated, plain',
  butter: 'Butter, salted',
  'cayenne pepper': 'Spices, pepper, red or cayenne',
  'cherry tomato': 'Tomatoes, red, ripe, raw, year round average',
  'chicken stock': 'Soup, stock, chicken, home-prepared',
  'chicken thigh': 'Chicken, broilers or fryers, thigh, meat and skin, raw',
  chilli: 'Peppers, hot chili, red, raw',
  'chipotles in adobo': 'Peppers, jalapeno, canned, solids and liquids',
  cinnamon: 'Spices, cinnamon, ground',
  'coconut milk': 'Nuts, coconut milk, raw (liquid expressed from grated meat and water)',
  coriander: 'Coriander (cilantro) leaves, raw',
  'corn tortilla': 'Tortillas, ready-to-bake or -fry, corn',
  cornflour: 'Cornstarch',
  ditalini: 'Pasta, dry, unenriched',
  'double cream': 'Cream, fluid, heavy whipping',
  'dried chilli': 'Peppers, ancho, dried',
  'firm tofu': 'Tofu, raw, firm, prepared with calcium sulfate',
  'fish sauce': 'Sauce, fish, ready-to-serve',
  'flat-leaf parsley': 'Parsley, fresh',
  'green papaya': 'Papayas, raw',
  'guajillo chilly': 'Peppers, ancho, dried',
  'kashmiri chilli powder': 'Spices, chili powder',
  mozzarella: 'Cheese, mozzarella, whole milk',
  'olive oil': 'Oil, olive, salad or cooking',
  oregano: 'Spices, oregano, dried',
  passata: 'Tomato products, canned, sauce',
  'pecorino romano': 'Cheese, romano',
  'plain flour': 'Wheat flour, white, all-purpose, unenriched',
  'pomegranate seed': 'Pomegranates, raw',
  pork: 'Pork, fresh, ground, raw',
  quesillo: 'Cheese, mexican, queso asadero',
  'red bell pepper': 'Peppers, sweet, red, raw',
  'red pepper': 'Peppers, sweet, red, raw',
  'refried black bean': 'Refried beans, canned, traditional style',
  salsa: 'Sauce, salsa, ready-to-serve',
  'sea salt flake': 'Salt, table',
  'sesame oil': 'Oil, sesame, salad or cooking',
  'sesame seed': 'Seeds, sesame seeds, whole, dried',
  'silken tofu': 'Tofu, soft, prepared with calcium sulfate and magnesium chloride (nigari)',
  soba: 'Noodles, japanese, soba, dry',
  'soy sauce': 'Soy sauce made from soy and wheat (shoyu)',
  'spicy salsa': 'Sauce, salsa, ready-to-serve',
  'spring onion': 'Onions, spring or scallions (includes tops and bulb), raw',
  sugar: 'Sugars, granulated',
  'sunflower oil': 'Oil, sunflower, linoleic, (approx. 65%)',
  'sweet paprika': 'Spices, paprika',
  tahini: 'Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type)',
  'tandoori masala': 'Spices, curry powder',
  'thai basil': 'Basil, fresh',
  'thai aubergine': 'Eggplant, raw',
  tomato: 'Tomatoes, red, ripe, raw, year round average',
  'tomato puree': 'Tomato products, canned, puree, without salt added',
  tonnarelli: 'Pasta, dry, unenriched',
  walnut: 'Nuts, walnuts, english',
  'white onion': 'Onions, raw',
  'white wine vinegar': 'Vinegar, red wine',
  water: 'Water, bottled, generic',
  yoghurt: 'Yogurt, plain, whole milk',
}

/** Description parts that mean "this is not the raw ingredient a recipe means". */
const BAD_PARTS =
  /\b(cooked|boiled|braised|roasted|fried|grilled|baked|canned|frozen|sweetened|creamed|drained|with salt|prepared|restaurant|fast food|babyfood|infant)\b/i

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize)

async function readCsv(path: string, onRow: (cells: string[]) => void) {
  // SR Legacy CSVs are RFC-quoted; fields never contain newlines, so a
  // line-by-line split-on-quoted-commas parse is safe and keeps memory flat
  // (food_nutrient.csv is 644k rows).
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  let first = true
  for await (const line of rl) {
    if (first) {
      first = false
      continue
    }
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') inQ = false
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') {
        cells.push(cur)
        cur = ''
      } else cur += ch
    }
    cells.push(cur)
    onRow(cells)
  }
}

const dir = process.argv[2]
if (!dir) {
  console.error('Usage: npm run build:usda -- /path/to/sr_legacy_csv_dir')
  process.exit(1)
}

// --- load foods ---
type Food = { fdcId: string; description: string; words: string[]; parts: string[] }
const foods: Food[] = []
await readCsv(`${dir}/food.csv`, (c) => {
  const [fdcId, , description] = c
  foods.push({
    fdcId,
    description,
    words: norm(description),
    parts: description.toLowerCase().split(',').map((p) => p.trim()),
  })
})

// --- canonical ingredients ---
const payload = await getPayload({ config })
const canon = await payload.find({ collection: 'ingredients', limit: 1000, depth: 0 })
const names = canon.docs.map((d) => String(d.name))

// --- match ---
function pick(name: string): Food | null {
  const alias = ALIASES[name.toLowerCase()]
  if (alias) {
    // An alias is a promise — if its description isn't found, report it rather
    // than falling through to fuzzy (that's how "fish sauce" briefly became a
    // McDonald's Filet-O-Fish).
    return foods.find((f) => f.description.toLowerCase() === alias.toLowerCase()) ?? null
  }
  const want = norm(normalizeItem(name))
  if (want.length === 0) return null

  let best: { f: Food; score: number } | null = null
  for (const f of foods) {
    // every canonical word must appear somewhere in the description
    if (!want.every((w) => f.words.includes(w))) continue
    let score = 60
    const head = norm(f.parts[0] ?? '')
    if (head.length === want.length && want.every((w) => head.includes(w))) score += 40
    if (f.parts.includes('raw')) score += 20
    if (BAD_PARTS.test(f.description)) score -= 60
    // Branded entries shout in caps (McDONALD'S, HOUSE FOODS) — never wanted
    // for a generic canonical ingredient.
    if (/[A-Z]{3,}/.test(f.description)) score -= 80
    score -= f.parts.length * 2 // prefer plainer entries
    if (!best || score > best.score) best = { f, score }
  }
  return best && best.score >= 55 ? best.f : null
}

const chosen = new Map<string, Food>()
const unmatched: string[] = []
for (const name of names) {
  const f = pick(name)
  if (f) chosen.set(name, f)
  else unmatched.push(name)
}

// --- nutrients for the chosen foods (one streaming pass) ---
const wantIds = new Set(Object.values(NUTRIENT_IDS))
const wantFdc = new Set([...chosen.values()].map((f) => f.fdcId))
const byFdc = new Map<string, Record<string, number>>()
await readCsv(`${dir}/food_nutrient.csv`, (c) => {
  const [, fdcId, nutrientId, amount] = c
  if (!wantFdc.has(fdcId) || !wantIds.has(nutrientId as never)) return
  const rec = byFdc.get(fdcId) ?? {}
  rec[nutrientId] = Number.parseFloat(amount)
  byFdc.set(fdcId, rec)
})

// --- piece weights: only portions that clearly describe one whole item ---
const PIECE = /\b(medium|whole|each|piece|clove|leaf|sprig)\b/i
const unitNames = new Map<string, string>()
await readCsv(`${dir}/measure_unit.csv`, (c) => unitNames.set(c[0], c[1]))
const pieceWeight = new Map<string, number>()
await readCsv(`${dir}/food_portion.csv`, (c) => {
  const [, fdcId, , amount, unitId, portionDesc, modifier, gramWeight] = c
  if (!wantFdc.has(fdcId) || pieceWeight.has(fdcId)) return
  const label = `${unitNames.get(unitId) ?? ''} ${portionDesc} ${modifier}`
  const g = Number.parseFloat(gramWeight)
  if (PIECE.test(label) && Number.parseFloat(amount) === 1 && g > 0 && g <= 1000) {
    pieceWeight.set(fdcId, g)
  }
})

// --- emit ---
const r1 = (n: number) => Math.round(n * 10) / 10
const out: Record<string, Record<string, number | string>> = {}
for (const [name, f] of [...chosen.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const n = byFdc.get(f.fdcId) ?? {}
  const sodium = n[NUTRIENT_IDS.sodiumMg]
  out[name] = {
    kcal: r1(n[NUTRIENT_IDS.kcal] ?? 0),
    protein: r1(n[NUTRIENT_IDS.protein] ?? 0),
    carbs: r1(n[NUTRIENT_IDS.carbs] ?? 0),
    fat: r1(n[NUTRIENT_IDS.fat] ?? 0),
    ...(n[NUTRIENT_IDS.saturates] != null ? { saturates: r1(n[NUTRIENT_IDS.saturates]) } : {}),
    ...(n[NUTRIENT_IDS.sugars] != null ? { sugars: r1(n[NUTRIENT_IDS.sugars]) } : {}),
    ...(n[NUTRIENT_IDS.fibre] != null ? { fibre: r1(n[NUTRIENT_IDS.fibre]) } : {}),
    // UK labelling talks salt, not sodium: salt g = sodium mg × 2.5 ÷ 1000.
    ...(sodium != null ? { salt: Math.round(sodium * 2.5) / 1000 } : {}),
    ...(pieceWeight.has(f.fdcId) ? { gramsPerPiece: pieceWeight.get(f.fdcId)! } : {}),
    fdcId: Number(f.fdcId),
    source: f.description,
  }
}

writeFileSync('src/data/usdaNutrition.json', JSON.stringify(out, null, 2) + '\n')

console.log(`\nmatched ${chosen.size}/${names.length} canonical ingredients → src/data/usdaNutrition.json`)
for (const [name, f] of [...chosen.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ✓ ${name}  →  ${f.description}`)
}
if (unmatched.length) {
  console.log(`\nunmatched (${unmatched.length}) — extend ALIASES or leave to the curated fallback:`)
  console.log(`  ${unmatched.join(', ')}`)
}
process.exit(0)
