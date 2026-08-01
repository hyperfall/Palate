/**
 * Parse a freeform ingredient line ("1 tsp ground cumin", "400g crushed
 * tomatoes") into { quantity, unit, item }. Creator-studio submissions are
 * pasted one line each, so the whole line would otherwise land in `item` with
 * no quantity/unit — breaking display and adaptive-servings scaling.
 *
 * Deterministic and conservative: it only pulls out a leading numeric quantity
 * and a recognised unit; anything it can't confidently split stays in `item`.
 * Every submission is human-reviewed in /admin before publishing, so a missed
 * split is corrected, not shipped.
 */
export type ParsedIngredient = { quantity?: string; unit?: string; item: string }

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
}

/** Alias → canonical unit. Only tokens here are treated as units. */
const UNITS: Record<string, string> = {
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'tin', tins: 'tin', jar: 'jar', jars: 'jar',
  slice: 'slice', slices: 'slice', sprig: 'sprig', sprigs: 'sprig',
  stick: 'stick', sticks: 'stick', bunch: 'bunch', bunches: 'bunch',
  pinch: 'pinch', pinches: 'pinch', dash: 'dash', dashes: 'dash',
  handful: 'handful', handfuls: 'handful', knob: 'knob', splash: 'splash',
}

/**
 * Units that read as words and take an -s in the plural. The abbreviations
 * (tsp, tbsp, g, ml, oz) never do — "3 tbsps" is wrong on a shopping list.
 */
const PLURALISES = new Set([
  'cup', 'clove', 'can', 'tin', 'jar', 'slice', 'sprig', 'stick', 'bunch',
  'pinch', 'dash', 'handful', 'knob', 'splash',
])

/**
 * Fold a free-text unit to its canonical spelling, or '' if it is not a unit
 * we know.
 *
 * `unit` is a free-text field in Payload and the studio lets a creator type
 * whatever they like, so "Tbsp", "tablespoons" and "tbsp" all reach the
 * database. Anything keying on the raw string treats those as three different
 * units — which is how a shopping list ended up printing "2 tbsp" and "1 Tbsp"
 * as separate lines for the same oil.
 */
export function canonicalUnit(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase()
  if (!key) return ''
  return UNITS[key] ?? key
}

/** The canonical unit as it should be printed for a given quantity. */
export function displayUnit(canonical: string, quantity: number): string {
  if (!canonical) return ''
  const plural = quantity > 1 && PLURALISES.has(canonical)
  return plural ? `${canonical}s` : canonical
}

const UF_CLASS = '½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞'
const QUANTITY_RE =
  /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)(\s*(?:-|–|to)\s*(?:\d+\/\d+|\d*\.\d+|\d+))?/

export function parseIngredientLine(raw: string): ParsedIngredient {
  // Split a unicode fraction glued to a digit ("1½" → "1 ½"), then to ascii.
  let s = raw.trim().replace(/\s+/g, ' ')
  s = s.replace(new RegExp(`(\\d)\\s*([${UF_CLASS}])`, 'g'), '$1 $2')
  s = s.replace(new RegExp(`[${UF_CLASS}]`, 'g'), (m) => UNICODE_FRACTIONS[m] ?? m)
  if (!s) return { item: '' }

  let quantity: string | undefined
  let unit: string | undefined

  const q = s.match(QUANTITY_RE)
  if (q && q[0].trim()) {
    quantity = q[0].trim().replace(/\s*(?:-|–|to)\s*/g, '–')
    s = s.slice(q[0].length).trim()
  }

  const t = s.match(/^([A-Za-z]+)\.?(?=\s|$)/)
  if (t && UNITS[t[1].toLowerCase()]) {
    unit = UNITS[t[1].toLowerCase()]
    s = s.slice(t[0].length).trim()
  }

  const item = s.replace(/^of\s+/i, '').trim()
  return { item, ...(quantity ? { quantity } : {}), ...(unit ? { unit } : {}) }
}
