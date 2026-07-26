/**
 * Classify a raw ingredient-list line.
 *
 * Recipe sources write a single ingredient across one line — "2 medium
 * tomatoes, cut in half" — but pasting or importing often breaks the qualifier
 * onto its own line. Stored as its own row it becomes a phantom ingredient: it
 * renders as a line item with a dotted leader pointing at no measure, mints a
 * canonical stub, and lands in the netted shopping list ("buy: cut in half").
 *
 * The rules are deliberately tight — a row is only a qualifier when it is
 * *nothing but* a qualifier, so real ingredients that happen to start with a
 * participle ("grated mozzarella", "chopped tomatoes") stay ingredients.
 */
export type RowKind = 'ingredient' | 'qualifier' | 'heading'

/** Section labels: "For the sauce", "To serve", or anything ending in a colon. */
const HEADING = /^(for the\b|to serve\b|to finish\b|to garnish\b|to assemble\b|for serving\b|garnishe?s?$|toppings?$)/i

const ADVERB = 'finely|roughly|thinly|coarsely|freshly|very'
const PARTICIPLE =
  'cut|chopped|diced|sliced|minced|quartered|halved|peeled|drained|rinsed|trimmed|grated|crushed|torn|shredded|beaten|melted|softened|toasted|deseeded|stemmed|zested|juiced|separated|divided|reserved|removed'

/** The whole line is a participle phrase: "quartered", "finely chopped". */
const QUALIFIER_ONLY = new RegExp(`^(?:(?:${ADVERB})\\s+)?(?:${PARTICIPLE})$`, 'i')
/** A participle followed by a preposition: "cut in half", "cut into wedges". */
const QUALIFIER_PHRASE = new RegExp(
  `^(?:(?:${ADVERB})\\s+)?(?:${PARTICIPLE})\\s+(in|into|to|on|off|from|with|lengthways|lengthwise|thinly|finely)\\b`,
  'i',
)
/** Standalone instructions that are never a shopping item. */
const QUALIFIER_PHRASES =
  /^(to taste|or to taste|at room temperature|room temperature|plus more\b|for dusting|for greasing|for frying|optional|ask your butcher|available online)/i

export function classifyIngredientRow(raw: string | null | undefined): RowKind {
  const t = (raw ?? '').trim()
  if (!t) return 'ingredient'
  if (/[:：]$/.test(t)) return 'heading'
  if (HEADING.test(t)) return 'heading'
  // A bare parenthetical ("(available online), stem and seeds removed") is a note.
  if (t.startsWith('(')) return 'qualifier'
  if (QUALIFIER_ONLY.test(t) || QUALIFIER_PHRASE.test(t) || QUALIFIER_PHRASES.test(t)) return 'qualifier'
  return 'ingredient'
}

export type RawRow = { quantity?: string | null; unit?: string | null; item: string; heading?: boolean | null }

/**
 * Fold qualifier rows into the ingredient above them and flag section labels.
 * A qualifier with no ingredient above it (nothing to attach to) is kept as-is
 * rather than dropped — never silently lose a creator's text.
 */
export function foldIngredientRows<T extends RawRow>(rows: T[]): Array<T & { heading?: boolean }> {
  const out: Array<T & { heading?: boolean }> = []
  for (const row of rows) {
    const hasMeasure = Boolean(row.quantity?.trim() || row.unit?.trim())
    const kind = hasMeasure ? 'ingredient' : classifyIngredientRow(row.item)

    if (kind === 'heading') {
      out.push({ ...row, heading: true })
      continue
    }
    const prev = out[out.length - 1]
    if (kind === 'qualifier' && prev && !prev.heading && prev.item.trim()) {
      const sep = row.item.trim().startsWith('(') ? ' ' : ', '
      out[out.length - 1] = { ...prev, item: `${prev.item.trim()}${sep}${row.item.trim()}` }
      continue
    }
    out.push({ ...row } as T & { heading?: boolean })
  }
  return out
}
