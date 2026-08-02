/**
 * Forgiving text matching for search.
 *
 * The suggest index already ranks strict matches well — prefix, then word-start,
 * then anywhere — and that ordering is worth keeping exactly as it is. What it
 * could not do is survive a typo or a spelling that is simply the other correct
 * one: "shakshouka" returned nothing at all, though the site carries shakshuka,
 * and every cook who spells it that way is right.
 *
 * So this is deliberately a LAST tier, never a replacement. Anything that
 * matched strictly still outranks anything that only matched fuzzily, because a
 * near-miss should fill an empty result list, not push aside an exact one.
 *
 * Pure and dependency-free so the thresholds are testable without a database.
 */

/**
 * Fold a string to its comparable form: lowercase, diacritics stripped,
 * punctuation flattened to spaces.
 *
 * Diacritics matter here more than they look. "Sauté", "purée" and "jalapeño"
 * are all spelled correctly with marks a hurried person will not type, and
 * without folding, "saute" misses "Sauté" entirely — a failure that reads as
 * the site not having the recipe.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Levenshtein distance, abandoned as soon as it exceeds `max`.
 *
 * The early exit is what makes this safe to run across an index on every
 * keystroke: most comparisons are nowhere near a match and stop after a row or
 * two rather than filling an entire matrix.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    let rowBest = curr[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      if (curr[j] < rowBest) rowBest = curr[j]
    }
    // Every path through this row already costs more than we allow.
    if (rowBest > max) return max + 1
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

/**
 * How much slack a query of this length earns.
 *
 * Short queries get none: at three characters, one edit reaches so many
 * unrelated words that the results stop looking like a search. The allowance
 * opens up as the query gets long enough for a typo to be the likeliest
 * explanation for a miss.
 */
export function allowedEdits(query: string): number {
  if (query.length <= 3) return 0
  if (query.length <= 6) return 1
  return 2
}

/**
 * Does `text` contain a word close enough to `query` to be a typo of it?
 *
 * Compares against each word AND against the leading slice of each word, so a
 * partly-typed "shakshou" still reaches "shakshuka" — someone mid-word has not
 * made a spelling mistake, they simply have not finished.
 */
export function fuzzyMatches(text: string, query: string): boolean {
  const terms = foldText(query).split(' ').filter(Boolean)
  if (terms.length === 0) return false
  const words = foldText(text).split(' ').filter(Boolean)
  if (words.length === 0) return false

  // EVERY word of the query has to find a home, but each is judged on its own
  // length — otherwise "butter chiken" is measured as one 13-character string
  // against single words and matches nothing, which is exactly what a person
  // typing a two-word dish name with one slip does not expect.
  return terms.every((term) => words.some((word) => nearEnough(word, term)))
}

function nearEnough(word: string, term: string): boolean {
  // Deliberately NOT a substring test. Substring matching is a stricter,
  // separate concept that the suggest route's earlier tiers already handle, and
  // folding it in here made short queries behave as wildcards: "tof" matched
  // "tofu" through the substring branch before the zero-slack rule could refuse
  // it. A partly-typed word still lands via the prefix check below, which is
  // bounded by the same allowance.
  const max = allowedEdits(term)
  if (max === 0) return false
  if (editDistance(word, term, max) <= max) return true
  // A prefix of a longer word: "shakshou" vs "shakshuka".
  return word.length > term.length && editDistance(word.slice(0, term.length), term, max) <= max
}
