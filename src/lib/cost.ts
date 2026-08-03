import { BASE_CURRENCY, type Money } from './money'
import { parseQuantity, toGrams, type NutritionIngredient } from './nutrition'

/**
 * What a recipe actually costs, from its ingredients.
 *
 * The site already carried a `costPerServing` per recipe: one number, typed by
 * hand, in GBP pence. It could only ever be a guess, it could not follow the
 * servings control, and it was the same figure whether you shop in London or
 * Lagos. This computes the number instead — quantity by quantity, at prices
 * the cook has actually recorded.
 *
 * It is deliberately the same shape as computeNutrition, and shares its
 * parsing: both walk the ingredient rows, turn a free-text quantity into a
 * number, convert it to grams through the ingredient's own density and
 * per-piece weight, and scale a per-100g figure. Cost is that pipeline with a
 * price where the calories go, so a recipe that can be nutrition-analysed can
 * be costed, and the two agree about what an amount means.
 *
 * The honesty rule throughout: an ingredient we cannot price is reported as
 * unpriced, never as zero. A total that quietly omits the beef is worse than
 * one that says it is missing the beef.
 */

/** What a cook pays for one ingredient. Money and amount travel together. */
export type IngredientPrice = {
  /** Cost of the pack, in minor units of `currency`. */
  priceMinor: number
  currency: string
  /** Size of that pack: 500 (g), 1 (piece), 750 (ml). */
  packAmount: number
  /** 'g' | 'ml' | 'piece' — what packAmount counts. */
  packUnit: 'g' | 'ml' | 'piece'
}

/** slug → what that ingredient costs. */
export type PriceBook = Map<string, IngredientPrice>

export type CostRow = {
  quantity?: string | null
  unit?: string | null
  item: string
  heading?: boolean | null
  /** The canonical ingredient, carrying density and per-piece weight. */
  ingredient?: (NutritionIngredient & { slug?: string | null }) | null
}

/** Why a row has no cost — the panel says which, rather than showing nothing. */
export type UnpricedReason =
  | 'no-amount' // "sea salt, to taste"
  | 'no-price' // nobody has told us what it costs
  | 'not-convertible' // "a 5cm piece of ginger" with no per-piece weight
  | 'wrong-currency' // priced, but not in the currency we are totalling in

export type CostLine = {
  item: string
  /** Null when this row could not be costed; `reason` says why. */
  minor: number | null
  reason?: UnpricedReason
}

export type CostResult = {
  currency: string
  lines: CostLine[]
  /** Whole recipe, in minor units — the sum of the lines we could price. */
  totalMinor: number
  /** Per serving, rounded once at the end rather than per line. */
  perServingMinor: number
  priced: number
  /** Rows that state an amount — the denominator coverage is measured against. */
  quantified: number
  /** True when every row carrying an amount was priced. */
  complete: boolean
}

/** Cost of `grams` of an ingredient priced by pack, in minor units. */
function costOfGrams(grams: number, price: IngredientPrice, densityGPerMl: number): number | null {
  if (price.packAmount <= 0) return null
  // Normalise the pack to grams so a 750ml bottle of oil and a 500g bag of
  // flour are the same kind of thing. A pack sold by volume needs the
  // ingredient's density; without one, assume water, which is what toGrams
  // does for the recipe side — the two must agree or the ratio is nonsense.
  const packGrams =
    price.packUnit === 'ml' ? price.packAmount * densityGPerMl : price.packAmount
  if (packGrams <= 0) return null
  return (grams / packGrams) * price.priceMinor
}

/**
 * Cost a recipe's ingredient rows.
 *
 * `currency` is what to total in — the cook's own. A price recorded in a
 * different one is NOT converted: exchange rates would need a live feed, and a
 * made-up rate in front of someone budgeting their week is exactly the kind of
 * confident wrong number this replaces. It is reported as unpriced instead.
 */
export function computeCost(
  rows: CostRow[],
  servings: number,
  prices: PriceBook,
  currency: string = BASE_CURRENCY,
): CostResult {
  const lines: CostLine[] = []
  let totalMinor = 0
  let priced = 0
  let quantified = 0

  for (const row of rows) {
    if (row.heading) continue

    const qty = parseQuantity(row.quantity)
    if (qty == null || qty <= 0) {
      // "Sea salt, to taste" is not a costing failure — it states no amount, so
      // it cannot count against coverage without making every recipe look
      // half-priced.
      lines.push({ item: row.item, minor: null, reason: 'no-amount' })
      continue
    }
    quantified++

    const ing = row.ingredient
    const slug = ing?.slug ?? null
    const price = slug ? prices.get(slug) : undefined
    if (!ing || !price) {
      lines.push({ item: row.item, minor: null, reason: 'no-price' })
      continue
    }
    if (price.currency.toUpperCase() !== currency.toUpperCase()) {
      lines.push({ item: row.item, minor: null, reason: 'wrong-currency' })
      continue
    }

    const density = ing.densityGPerMl ?? 1

    // Countable things priced per piece skip grams entirely: "2 eggs" at 30p an
    // egg needs no weight at all, and demanding one would leave every egg,
    // clove and tin unpriced for want of a number nobody has.
    let minor: number | null
    if (price.packUnit === 'piece') {
      minor = (qty / price.packAmount) * price.priceMinor
    } else {
      const grams = toGrams(qty, row.unit, ing)
      minor = grams == null || grams <= 0 ? null : costOfGrams(grams, price, density)
    }

    if (minor == null || !Number.isFinite(minor)) {
      lines.push({ item: row.item, minor: null, reason: 'not-convertible' })
      continue
    }

    const rounded = Math.round(minor)
    lines.push({ item: row.item, minor: rounded })
    totalMinor += rounded
    priced++
  }

  const perServing = servings > 0 ? totalMinor / servings : 0

  return {
    currency: currency.toUpperCase(),
    lines,
    totalMinor,
    perServingMinor: Math.round(perServing),
    priced,
    quantified,
    complete: quantified > 0 && priced === quantified,
  }
}

/** The recipe total as Money, for a caller that just wants to print it. */
export function totalAsMoney(result: CostResult): Money {
  return { minor: result.totalMinor, currency: result.currency }
}

/** The per-serving figure as Money. */
export function perServingAsMoney(result: CostResult): Money {
  return { minor: result.perServingMinor, currency: result.currency }
}
