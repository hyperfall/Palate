import { BASE_CURRENCY, type Money } from './money'
import { isMeasuredUnit, parseQuantity, toGrams, type NutritionIngredient } from './nutrition'

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
  /**
   * How much of one pack this row uses — 0.6 of a 500 g bag, 2.5 tubs.
   *
   * The bridge between what a dish CONSUMES and what it costs to SHOP FOR.
   * Cooking cost is this times the pack price; shopping cost is the same
   * against the next whole number, because a shop sells whole tubs. Derived
   * here rather than recomputed elsewhere so the two can never disagree about
   * an amount.
   */
  packFraction?: number
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

/**
 * How many pieces a row uses, for an ingredient sold by the item.
 *
 * Countable things skip grams entirely when the row is a count: "2 eggs" at
 * 30p an egg needs no weight, and demanding one would leave every egg, clove
 * and tin unpriced for want of a number nobody has.
 *
 * But a row may state a WEIGHT of something sold by the item — "400 g crushed
 * tomatoes", where tomato is priced per tomato. Reading that quantity as a
 * count is how a tin of tomatoes came out at £120 and took a plate of
 * shakshuka to £30.95. So a measured unit is converted to grams first and then
 * to pieces through the ingredient's own per-piece weight; without one, it is
 * honestly unpriceable rather than wrong by a factor of a hundred.
 *
 * An unmeasured unit — "2 tins", "3 cloves", "1 bunch" — is still a count.
 */
function toPieces(
  quantity: number,
  unitRaw: string | null | undefined,
  ing: NutritionIngredient,
): number | null {
  if (!isMeasuredUnit(unitRaw)) return quantity

  const grams = toGrams(quantity, unitRaw, ing)
  if (grams == null || grams <= 0) return null
  const per = ing.gramsPerPiece
  if (per == null || per <= 0) return null
  return grams / per
}

/** What fraction of one pack `grams` represents. */
function packsOfGrams(
  grams: number,
  price: IngredientPrice,
  densityGPerMl: number,
): number | null {
  if (price.packAmount <= 0) return null
  // Normalise the pack to grams so a 750ml bottle of oil and a 500g bag of
  // flour are the same kind of thing. A pack sold by volume needs the
  // ingredient's density; without one, assume water, which is what toGrams
  // does for the recipe side — the two must agree or the ratio is nonsense.
  const packGrams =
    price.packUnit === 'ml' ? price.packAmount * densityGPerMl : price.packAmount
  if (packGrams <= 0) return null
  return grams / packGrams
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

    // How much of a pack this row uses. Money comes from it rather than beside
    // it, so the cooking and shopping readings share one number.
    let packs: number | null
    if (price.packUnit === 'piece') {
      const pieces = toPieces(qty, row.unit, ing)
      packs = pieces == null || price.packAmount <= 0 ? null : pieces / price.packAmount
    } else {
      const grams = toGrams(qty, row.unit, ing)
      packs = grams == null || grams <= 0 ? null : packsOfGrams(grams, price, density)
    }

    if (packs == null || !Number.isFinite(packs)) {
      lines.push({ item: row.item, minor: null, reason: 'not-convertible' })
      continue
    }

    const rounded = Math.round(packs * price.priceMinor)
    lines.push({ item: row.item, minor: rounded, packFraction: packs })
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
