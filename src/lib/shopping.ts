import type { CostResult } from './cost'
import type { Costing } from './costing'

/**
 * What the dish costs to COOK, and what it costs to SHOP FOR.
 *
 * These are different numbers and every recipe site shows only the first. Cook
 * one dish needing 30 g of gochujang and the meal consumes about 11p — but the
 * shop sells a £1.80 tub, and £1.80 is what leaves your account. That gap is
 * the honest answer to "why was my shop £60 when the recipes said £12", and it
 * is the reason a first attempt at a new cuisine feels so expensive and the
 * second does not.
 *
 * Nothing new is measured here. Every row already records what was bought and
 * how much the dish uses, and the engine already reports the fraction of a pack
 * that represents; this only rounds that fraction up to whole packs, because
 * that is what a shop actually sells you.
 */

export type ShoppingLine = {
  item: string
  /** Whole packs you have to buy to cook this once. */
  packs: number
  /** What those packs cost. */
  shopMinor: number
  /** What the dish actually consumes of them. */
  usedMinor: number
  /** Value of what is left in the cupboard afterwards. */
  leftoverMinor: number
  /** True when the dish uses less than one whole pack — the cupboard case. */
  partial: boolean
}

export type ShoppingResult = {
  currency: string
  lines: ShoppingLine[]
  /** What the dish consumes. Matches the calculator's total exactly. */
  cookingMinor: number
  /** What you must buy to cook it once, from an empty cupboard. */
  shoppingMinor: number
  /** What remains afterwards, at what it cost. */
  leftoverMinor: number
  /**
   * Cooking it a second time, using up what the first time left.
   *
   * The number that makes a cupboard feel worth stocking. Only ingredients
   * whose leftovers do not cover a second go need buying again.
   */
  secondTimeMinor: number
  /** True when nothing could be costed, so every figure above is zero. */
  empty: boolean
}

/**
 * Derive the shopping reading from a costing and its computed cost.
 *
 * `result` must be the output of `computeCost` for this same costing —
 * `packFraction` is the shared number, and recomputing it here would be a
 * second implementation free to drift from the first.
 */
export function computeShopping(costing: Costing, result: CostResult): ShoppingResult {
  const lines: ShoppingLine[] = []
  let cookingMinor = 0
  let shoppingMinor = 0
  let secondTimeMinor = 0

  result.lines.forEach((line, i) => {
    const item = costing.items[i]
    const fraction = line.packFraction
    if (!item || line.minor == null || fraction == null || fraction <= 0) return
    const price = item.priceMinor
    if (price == null) return

    // A shop sells whole tubs. Half a tub is not a thing you can buy.
    const packs = Math.ceil(fraction - 1e-9)
    const shopMinor = Math.round(packs * price)
    const usedMinor = line.minor

    cookingMinor += usedMinor
    shoppingMinor += shopMinor

    // Second time: the leftover goes first, and only the shortfall is bought.
    const leftoverPacks = packs - fraction
    const stillNeeded = Math.max(0, fraction - leftoverPacks)
    secondTimeMinor += Math.round(Math.ceil(stillNeeded - 1e-9) * price)

    lines.push({
      item: line.item,
      packs,
      shopMinor,
      usedMinor,
      leftoverMinor: shopMinor - usedMinor,
      partial: fraction < 1,
    })
  })

  return {
    currency: result.currency,
    lines,
    cookingMinor,
    shoppingMinor,
    leftoverMinor: shoppingMinor - cookingMinor,
    secondTimeMinor,
    empty: lines.length === 0,
  }
}

/** The rows with the most money sitting in the cupboard, worst first. */
export function biggestLeftovers(shopping: ShoppingResult, limit = 3): ShoppingLine[] {
  return [...shopping.lines]
    .filter((l) => l.leftoverMinor > 0)
    .sort((a, b) => b.leftoverMinor - a.leftoverMinor)
    .slice(0, limit)
}
