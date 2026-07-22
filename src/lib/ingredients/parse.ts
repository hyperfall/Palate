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
