// src/lib/ingredients/normalize.ts
import { parseIngredientLine } from './parse'

/** Descriptor words stripped from ingredient names before matching. */
const DESCRIPTORS = new Set([
  'fresh', 'freshly', 'dried', 'ground', 'chopped', 'minced', 'sliced', 'diced',
  'grated', 'crushed', 'whole', 'large', 'small', 'medium', 'ripe', 'boneless',
  'skinless', 'raw', 'cooked', 'extra', 'virgin', 'extra-virgin', 'toasted',
  'roasted', 'unsalted', 'salted', 'organic', 'finely', 'roughly', 'thinly',
])

/** Phrases that, once seen, truncate the rest of the string. */
const TAIL_MARKERS = [' to taste', ' for garnish', ' plus more', ' for dusting', ' for serving']

/** Mass nouns that already end in "-ss(es)" but have no distinct singular form. */
const INVARIANT = new Set(['molasses'])

/**
 * Count-units that, when they TRAIL another word, describe a form of the base
 * ingredient rather than a distinct ingredient — "garlic clove" is garlic,
 * "thyme sprig" is thyme. Leading units are already peeled by parseIngredientLine
 * ("3 cloves garlic" → "garlic"); this catches the item-first phrasing so the two
 * don't split into near-duplicate canonicals.
 */
const TRAILING_COUNT_UNITS = new Set(['clove', 'sprig', 'stalk'])

export function singularize(word: string): string {
  if (word.length < 4) return word
  if (INVARIANT.has(word)) return word
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.endsWith('oes')) return word.slice(0, -2) // tomatoes -> tomato
  if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('ss')) return word
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

export function normalizeItem(raw: string): string {
  // Peel a leading quantity + unit ("2 tbsp olive oil" → "olive oil") so the
  // canonical name is the ingredient, not the measure. The structured form
  // splits these out now, but pasted lines and legacy rows still glue them on —
  // without this the catalog fills with "tbsp olive oil"-style names.
  const item = parseIngredientLine(raw).item || raw
  // Fold accents first (purée → puree, jalapeño → jalapeno) so the later
  // ascii-only filter doesn't punch a hole mid-word ("pur e") and split a name
  // off from its unaccented twin.
  let s = item
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .trim()
  s = s.replace(/\([^)]*\)/g, ' ') // drop parentheticals
  s = s.split(',')[0] // keep the head, drop ", minced" etc.
  for (const marker of TAIL_MARKERS) {
    const i = s.indexOf(marker)
    if (i >= 0) s = s.slice(0, i)
  }
  s = s.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  // drop a leading quantity token like "2" or "1/2"
  s = s.replace(/^[\d/.\s]+/, '').trim()
  const kept = s.split(' ').filter((w) => w && !DESCRIPTORS.has(w))
  if (kept.length === 0) return ''
  kept[kept.length - 1] = singularize(kept[kept.length - 1])
  // Drop a trailing count-unit ("garlic clove" → "garlic") so item-first phrasing
  // collapses to the same canonical as "cloves garlic". Only when it isn't the
  // whole name, so the spice "clove" survives on its own.
  if (kept.length > 1 && TRAILING_COUNT_UNITS.has(kept[kept.length - 1])) {
    kept.pop()
    kept[kept.length - 1] = singularize(kept[kept.length - 1])
  }
  return kept.join(' ')
}
