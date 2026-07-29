import { singularize } from './normalize'

/**
 * Work out which of a recipe's ingredients a given step is talking about.
 *
 * Every step in the catalog has an empty `uses` relation — 0 of 92 — because
 * linking each step to its ingredients by hand is work no creator will ever do,
 * for any recipe, ever. So cook mode's "You'll need" row has never shown
 * anything. This derives the same answer from the text, which is only possible
 * because every ingredient row already carries a canonical name.
 *
 * Deliberately conservative: a missing chip costs a glance at the full list, an
 * invented one sends someone to the fridge for something the step doesn't want.
 * Matching is on whole words against both the written item ("guajillo chillies")
 * and its canonical singular ("guajillo chilli"), so "oil" inside "boiling"
 * can't match sunflower oil.
 */

export type MatchableIngredient = {
  item: string
  canonicalName?: string | null
  heading?: boolean | null
}

/** Words too generic to identify an ingredient on their own. */
const WEAK = new Set([
  'oil',
  'water',
  'salt',
  'pepper',
  'sugar',
  'flour',
  'stock',
  'butter',
  'sauce',
  'paste',
  'powder',
  'leaf',
  'leaves',
  'seed',
  'seeds',
  'fresh',
  'dried',
  'ground',
  'large',
  'small',
  'medium',
  'whole',
  'half',
  'the',
  'and',
  'to',
  'serve',
])

/**
 * Prose words. These are excluded from the "unique word" rule, which is
 * otherwise happy to decide that the "in" inside "medium tomatoes, cut in half"
 * makes any step containing "in" a request for tomatoes — a real bug this
 * caught on Birria's first step.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'into', 'on', 'to', 'for', 'with', 'from', 'at', 'by',
  'plus', 'about', 'per', 'each', 'available', 'online', 'optional', 'preferably', 'roughly',
  'finely', 'thinly', 'cut', 'chopped', 'sliced', 'diced', 'minced', 'grated', 'crushed', 'peeled',
  'trimmed', 'removed', 'reserved', 'stem', 'seed', 'quartered', 'halved', 'wedge', 'piece', 'chunk',
])

/**
 * Descriptors. A step calling a dish spicy is not asking for the spicy salsa —
 * also real, from Birria's second step.
 */
const DESCRIPTORS = new Set([
  'spicy', 'hot', 'mild', 'sweet', 'sour', 'salty', 'fresh', 'dried', 'ground', 'whole', 'large',
  'small', 'medium', 'baby', 'ripe', 'raw', 'cooked', 'warm', 'cold', 'thick', 'thin', 'light',
  'dark', 'extra', 'plain', 'free', 'low', 'full', 'good', 'best', 'nice',
])

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * The phrases that would identify this ingredient in prose. The full name, and
 * the full name minus a leading qualifier ("white onion" → "onion"), each in
 * singular form so "chillies" in the step finds "chilli" in the pantry.
 */
function tokensOf(ing: MatchableIngredient): string[][] {
  const out: string[][] = []
  for (const source of [ing.canonicalName ?? '', ing.item]) {
    const w = words(source).map(singularize)
    if (w.length) out.push(w)
  }
  return out
}

export function matchIngredientsInStep<T extends MatchableIngredient>(
  stepText: string,
  ingredients: T[],
): T[] {
  if (!stepText.trim()) return []
  const step = words(stepText).map(singularize)
  const rows = ingredients.filter((i) => !i.heading)
  if (rows.length === 0) return []

  // How many ingredients use each word. A word belonging to exactly one of them
  // identifies it on its own — "guajillo" can only mean the guajillo chilli —
  // which is the only way to read "the guajillo and ancho chillies", where the
  // noun is shared and neither full name appears contiguously.
  // Counted over CANONICAL names only. The written item carries preparation
  // prose ("cut in half", "available online") whose words are not the
  // ingredient's identity and must never stand in for it.
  const identifying = (w: string) =>
    w.length >= 4 && !WEAK.has(w) && !STOPWORDS.has(w) && !DESCRIPTORS.has(w)

  const owners = new Map<string, number>()
  for (const ing of rows) {
    const canon = words(ing.canonicalName ?? ing.item).map(singularize)
    for (const w of new Set(canon)) {
      if (identifying(w)) owners.set(w, (owners.get(w) ?? 0) + 1)
    }
  }

  // Every phrase worth looking for, longest first: "white onion" must get the
  // chance to claim those two words before plain "onion" takes one of them.
  type Candidate = { ing: T; phrase: string[] }
  const candidates: Candidate[] = []
  for (const ing of rows) {
    for (const phrase of tokensOf(ing)) {
      candidates.push({ ing, phrase })
      const last = phrase[phrase.length - 1]
      // The head noun as a fallback, but only when it means something alone.
      if (phrase.length > 1 && !WEAK.has(last)) candidates.push({ ing, phrase: [last] })
      // Any content word unique to this ingredient across the whole recipe.
      for (const w of phrase) {
        if (phrase.length > 1 && identifying(w) && owners.get(w) === 1) {
          candidates.push({ ing, phrase: [w] })
        }
      }
    }
  }
  candidates.sort((a, b) => b.phrase.length - a.phrase.length)

  // Consumed token positions stop a shorter phrase reusing a word a longer one
  // already claimed, so "white onion" in the text can't also match "onion".
  const consumed = new Set<number>()
  const chosen = new Set<T>()
  const seen = new Set<string>()

  for (const { ing, phrase } of candidates) {
    const key = (ing.canonicalName ?? ing.item).toLowerCase()
    if (seen.has(key)) continue
    for (let i = 0; i + phrase.length <= step.length; i++) {
      let ok = true
      for (let j = 0; j < phrase.length; j++) {
        if (step[i + j] !== phrase[j] || consumed.has(i + j)) {
          ok = false
          break
        }
      }
      if (!ok) continue
      for (let j = 0; j < phrase.length; j++) consumed.add(i + j)
      seen.add(key)
      chosen.add(ing)
      break
    }
  }

  // Recipe order, not order of mention: the cook read the list in that order.
  return rows.filter((i) => chosen.has(i))
}
