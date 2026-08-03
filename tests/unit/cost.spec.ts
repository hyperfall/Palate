import { describe, expect, it } from 'vitest'

import { computeCost, type CostRow, type PriceBook } from '@/lib/cost'

/**
 * Costing a recipe from what the cook actually pays.
 *
 * The behaviour under test is mostly about honesty: what the total does when
 * an ingredient cannot be priced. Silently treating it as free produces a
 * number that looks authoritative and is wrong, which is the failure the
 * hand-typed costPerServing had.
 */

const book = (entries: Record<string, [number, string, number, 'g' | 'ml' | 'piece']>): PriceBook =>
  new Map(
    Object.entries(entries).map(([slug, [priceMinor, currency, packAmount, packUnit]]) => [
      slug,
      { priceMinor, currency, packAmount, packUnit },
    ]),
  )

const row = (
  quantity: string | null,
  unit: string | null,
  item: string,
  slug?: string,
  extra: { densityGPerMl?: number; gramsPerPiece?: number } = {},
): CostRow => ({
  quantity,
  unit,
  item,
  ingredient: slug ? { slug, ...extra } : null,
})

describe('costing by weight', () => {
  it('scales the pack price to the amount used', () => {
    // £2.50 for 500g, using 200g → £1.00
    const result = computeCost([row('200', 'g', 'Flour', 'flour')], 1, book({ flour: [250, 'GBP', 500, 'g'] }), 'GBP')
    expect(result.lines[0].minor).toBe(100)
    expect(result.totalMinor).toBe(100)
  })

  it('reads fractions, which is how recipes are written', () => {
    // parseFloat("1/2") is 1 — half a kilo of beef costed as a whole one.
    const result = computeCost([row('1/2', 'kg', 'Beef', 'beef')], 1, book({ beef: [1000, 'GBP', 1000, 'g'] }), 'GBP')
    expect(result.lines[0].minor).toBe(500)
  })

  it('converts units before applying the price', () => {
    const result = computeCost([row('1', 'kg', 'Flour', 'flour')], 1, book({ flour: [250, 'GBP', 500, 'g'] }), 'GBP')
    expect(result.lines[0].minor).toBe(500)
  })
})

describe('costing by volume', () => {
  it('uses the ingredient density so a bottle and a bag are comparable', () => {
    // Oil at 0.92 g/ml: a 750ml bottle is 690g. Using 100ml (92g) of a £3.00
    // bottle is 92/690 × 300 = 40p.
    const result = computeCost(
      [row('100', 'ml', 'Olive oil', 'olive-oil', { densityGPerMl: 0.92 })],
      1,
      book({ 'olive-oil': [300, 'GBP', 750, 'ml'] }),
      'GBP',
    )
    expect(result.lines[0].minor).toBe(40)
  })

  it('agrees with itself when the pack is sold by weight but used by volume', () => {
    // 1 litre of water-density stock = 1000g, from a 500g pack costing £1.
    const result = computeCost([row('1', 'l', 'Stock', 'stock')], 1, book({ stock: [100, 'GBP', 500, 'g'] }), 'GBP')
    expect(result.lines[0].minor).toBe(200)
  })
})

describe('costing countable things', () => {
  it('prices per piece without needing a weight', () => {
    // £3.00 for 12 eggs, using 2 → 50p. Requiring grams here would leave every
    // egg, clove and tin unpriced for want of a number nobody has.
    const result = computeCost([row('2', null, 'Eggs', 'egg')], 1, book({ egg: [300, 'GBP', 12, 'piece'] }), 'GBP')
    expect(result.lines[0].minor).toBe(50)
  })

  it('prices a single-item pack', () => {
    const result = computeCost([row('1', null, 'Onion', 'onion')], 1, book({ onion: [35, 'GBP', 1, 'piece'] }), 'GBP')
    expect(result.lines[0].minor).toBe(35)
  })
})

describe('what it refuses to guess', () => {
  it('reports an amountless row without counting it against coverage', () => {
    // "Sea salt, to taste" is not a costing failure. Counting it would make
    // every recipe look half-priced.
    const result = computeCost(
      [row('200', 'g', 'Flour', 'flour'), row(null, null, 'Sea salt, to taste', 'salt')],
      1,
      book({ flour: [250, 'GBP', 500, 'g'], salt: [100, 'GBP', 1000, 'g'] }),
      'GBP',
    )
    expect(result.lines[1].reason).toBe('no-amount')
    expect(result.quantified).toBe(1)
    expect(result.complete).toBe(true)
  })

  it('marks an unpriced ingredient rather than treating it as free', () => {
    const result = computeCost(
      [row('200', 'g', 'Flour', 'flour'), row('500', 'g', 'Beef', 'beef')],
      1,
      book({ flour: [250, 'GBP', 500, 'g'] }),
      'GBP',
    )
    expect(result.lines[1].minor).toBeNull()
    expect(result.lines[1].reason).toBe('no-price')
    expect(result.totalMinor).toBe(100)
    expect(result.complete).toBe(false)
    expect(result.priced).toBe(1)
    expect(result.quantified).toBe(2)
  })

  it('will not convert a price in another currency', () => {
    // A made-up exchange rate in front of someone budgeting their week is
    // exactly the confident wrong number this replaces.
    const result = computeCost([row('200', 'g', 'Flour', 'flour')], 1, book({ flour: [250, 'EUR', 500, 'g'] }), 'GBP')
    expect(result.lines[0].minor).toBeNull()
    expect(result.lines[0].reason).toBe('wrong-currency')
    expect(result.totalMinor).toBe(0)
    expect(result.complete).toBe(false)
  })

  it('reports a length measure it cannot weigh', () => {
    const result = computeCost([row('5', 'cm', 'Ginger', 'ginger')], 1, book({ ginger: [200, 'GBP', 100, 'g'] }), 'GBP')
    expect(result.lines[0].reason).toBe('not-convertible')
  })

  it('skips section headings', () => {
    const rows: CostRow[] = [
      { item: 'For the sauce', heading: true },
      row('200', 'g', 'Flour', 'flour'),
    ]
    const result = computeCost(rows, 1, book({ flour: [250, 'GBP', 500, 'g'] }), 'GBP')
    expect(result.lines).toHaveLength(1)
    expect(result.quantified).toBe(1)
  })
})

describe('per serving', () => {
  it('divides the total by the servings', () => {
    const result = computeCost([row('1', 'kg', 'Flour', 'flour')], 4, book({ flour: [400, 'GBP', 1000, 'g'] }), 'GBP')
    expect(result.totalMinor).toBe(400)
    expect(result.perServingMinor).toBe(100)
  })

  it('rounds once at the end, not per serving', () => {
    // £1.70 across 3 servings is 56.67p. Rounding each line first would drift.
    const result = computeCost([row('100', 'g', 'Miso', 'miso')], 3, book({ miso: [170, 'GBP', 100, 'g'] }), 'GBP')
    expect(result.totalMinor).toBe(170)
    expect(result.perServingMinor).toBe(57)
  })

  it('does not divide by zero servings', () => {
    const result = computeCost([row('100', 'g', 'Miso', 'miso')], 0, book({ miso: [170, 'GBP', 100, 'g'] }), 'GBP')
    expect(result.perServingMinor).toBe(0)
    expect(Number.isFinite(result.perServingMinor)).toBe(true)
  })
})

describe('a recipe with nothing priced', () => {
  it('is not reported as complete', () => {
    const result = computeCost([row('200', 'g', 'Flour', 'flour')], 2, new Map(), 'GBP')
    expect(result.complete).toBe(false)
    expect(result.totalMinor).toBe(0)
    expect(result.priced).toBe(0)
  })

  it('is not reported as complete when there is nothing to price at all', () => {
    const result = computeCost([], 2, new Map(), 'GBP')
    expect(result.complete).toBe(false)
    expect(result.quantified).toBe(0)
  })
})

describe('the worked example from the brief', () => {
  it('totals a five-ingredient soup to its cost per serving', () => {
    // Shimeji 50p, enoki 40p, sprouts 25p, onion 35p, miso 20p = £1.70 over
    // 3 servings = 57p.
    const rows = [
      row('100', 'g', 'Shimeji mushrooms', 'shimeji'),
      row('100', 'g', 'Enoki mushrooms', 'enoki'),
      row('100', 'g', 'Bean sprouts', 'sprouts'),
      row('1', null, 'Onion', 'onion'),
      row('30', 'g', 'Miso', 'miso'),
    ]
    const prices = book({
      shimeji: [250, 'GBP', 500, 'g'],
      enoki: [200, 'GBP', 500, 'g'],
      sprouts: [125, 'GBP', 500, 'g'],
      onion: [35, 'GBP', 1, 'piece'],
      miso: [200, 'GBP', 300, 'g'],
    })
    const result = computeCost(rows, 3, prices, 'GBP')
    expect(result.lines.map((l) => l.minor)).toEqual([50, 40, 25, 35, 20])
    expect(result.totalMinor).toBe(170)
    expect(result.perServingMinor).toBe(57)
    expect(result.complete).toBe(true)
  })
})
