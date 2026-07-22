// src/lib/ingredients/normalize.ts
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
  let s = raw.toLowerCase().trim()
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
  return kept.join(' ')
}
