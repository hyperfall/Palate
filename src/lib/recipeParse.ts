import { foldIngredientRows } from './ingredients/rows'
import { parseIngredientLine } from './ingredients/parse'

/**
 * Turn a pasted blob of recipe text into structured rows.
 *
 * Creators already have their recipes written down — in Notes, a doc, a message
 * to a friend. Retyping that into a form row by row is the single biggest tax
 * the studio charges, and it's the one every recipe app has raced to remove.
 * Palate can do it better than most: the same quantity/unit/item parser and
 * qualifier folding that back the ingredient graph do the work here.
 *
 * Nothing is guessed silently — everything lands in the normal editor for the
 * creator to correct, so a wrong split costs a keystroke, not a bad recipe.
 */

export type ParsedRecipe = {
  title: string
  servings: number | null
  prepMinutes: number | null
  cookMinutes: number | null
  ingredientRows: Array<{ quantity: string; unit: string; item: string; heading?: boolean }>
  stepRows: string[]
}

const SECTION = {
  ingredients: /^(ingredients?|you(?:'|’)?ll need|shopping list)\s*:?\s*$/i,
  method: /^(method|instructions?|steps?|directions?|to cook|how to)\s*:?\s*$/i,
}

/** "Serves 4", "serves 4-6", "4 servings", "feeds 6" */
const SERVES = /(?:serves|feeds)\s*(\d+)|(\d+)\s*(?:servings?|portions?)/i
/**
 * "1 h 15", "1hr 15min", "90 minutes", "prep 10 min". Hours and minutes are
 * matched separately — one optional group either side of a gap will happily
 * match the empty string before the first word and report nothing.
 */
const minutesFrom = (text: string): number | null => {
  const hours = text.match(/(\d+)\s*(?:h|hr|hour)s?/i)
  const mins = text.match(/(\d+)\s*(?:m|min|minute)s?\b/i)
  let total = 0
  if (hours) total += Number(hours[1]) * 60
  if (mins) total += Number(mins[1])
  else if (hours) {
    // "1 h 15" — a bare number trailing the hours is the minutes.
    const after = text.slice(text.indexOf(hours[0]) + hours[0].length)
    const bare = after.match(/^\s*(\d+)/)
    if (bare) total += Number(bare[1])
  }
  if (!hours && !mins) {
    // "Total 90" — a bare number is only a duration when the line says so.
    const bare = /^(total|time|prep|cook)/i.test(text) ? text.match(/(\d+)/) : null
    if (!bare) return null
    total = Number(bare[1])
  }
  return total || null
}

/** A line that is only metadata (times, yield) — never a title or an ingredient. */
const isMetaLine = (line: string): boolean =>
  /^(prep|cook|total|time|serves|feeds|yield|makes)\b/i.test(line) ||
  (SERVES.test(line) && line.split(/\s+/).length <= 6)

/** Numbered or bulleted list markers, stripped before classifying. */
const stripMarker = (line: string): string =>
  line.replace(/^\s*(?:step\s*)?\d+\s*[.)\]:-]\s*/i, '').replace(/^\s*[-–—*•]\s+/, '').trim()

/**
 * Does this read like an instruction rather than a shopping item? Steps are
 * sentences: they're long, and they start with a verb rather than an amount.
 */
const looksLikeStep = (line: string): boolean => {
  const words = line.split(/\s+/).length
  if (words >= 9) return true
  return words >= 4 && /[.!]$/.test(line)
}

export function parseRecipeText(raw: string): ParsedRecipe {
  const lines = (raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let title = ''
  let servings: number | null = null
  let prepMinutes: number | null = null
  let cookMinutes: number | null = null
  const ingredientRows: ParsedRecipe['ingredientRows'] = []
  const stepRows: string[] = []

  // Explicit headers win; without them we infer, and once a step appears the
  // ingredient list is over (recipes never go back).
  let section: 'unknown' | 'ingredients' | 'method' = 'unknown'
  let sawStep = false

  for (const line of lines) {
    if (SECTION.ingredients.test(line)) {
      section = 'ingredients'
      continue
    }
    if (SECTION.method.test(line)) {
      section = 'method'
      continue
    }

    // Metadata anywhere: yield and timings.
    if (isMetaLine(line)) {
      const s = line.match(SERVES)
      if (s) servings = Number(s[1] ?? s[2]) || servings
      if (/^prep/i.test(line)) prepMinutes = minutesFrom(line) ?? prepMinutes
      else if (/^cook/i.test(line)) cookMinutes = minutesFrom(line) ?? cookMinutes
      else cookMinutes = minutesFrom(line) ?? cookMinutes
      continue
    }

    // The first ordinary line is the title.
    if (!title && section === 'unknown') {
      const parsed = parseIngredientLine(line)
      if (!parsed.quantity && !looksLikeStep(line)) {
        title = line
        continue
      }
    }

    const body = stripMarker(line)
    if (!body) continue

    const numbered = /^\s*(?:step\s*)?\d+\s*[.)\]:]/i.test(line)
    const parsed = parseIngredientLine(body)
    const isStep =
      section === 'method' ||
      (section !== 'ingredients' && (numbered || sawStep || (!parsed.quantity && looksLikeStep(body))))

    if (isStep) {
      sawStep = true
      stepRows.push(body)
      continue
    }

    ingredientRows.push({
      quantity: parsed.quantity ?? '',
      unit: parsed.unit ?? '',
      item: parsed.item || body,
    })
  }

  return {
    title,
    servings,
    prepMinutes,
    cookMinutes,
    // The same fold the studio and the save path use: qualifiers merge into the
    // line above, section labels are flagged.
    ingredientRows: foldIngredientRows(ingredientRows).map((r) => ({
      quantity: r.quantity ?? '',
      unit: r.unit ?? '',
      item: r.item,
      ...(r.heading ? { heading: true } : {}),
    })),
    stepRows,
  }
}
