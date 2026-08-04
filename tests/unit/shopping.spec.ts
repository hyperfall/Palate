import { describe, expect, it } from 'vitest'

import { computeCost } from '@/lib/cost'
import { emptyCosting, emptyItem, toCostInput, type Costing, type CostingItem } from '@/lib/costing'
import { biggestLeftovers, computeShopping } from '@/lib/shopping'

/**
 * The gap between cooking a dish and shopping for it.
 *
 * Cook one dish needing 30 g of gochujang and the meal consumes 11p, but the
 * shop sells a £1.80 tub. Both numbers are true and only one of them leaves
 * your account, which is why a first attempt at a new cuisine feels expensive
 * and the second does not.
 */

const item = (over: Partial<CostingItem> = {}): CostingItem => ({
  ...emptyItem('gochujang', 'gochujang'),
  priceMinor: 180,
  packAmount: 90,
  packUnit: 'g',
  useAmount: '30',
  useUnit: 'g',
  ...over,
})

function run(items: CostingItem[], servings = 4) {
  const costing: Costing = { ...emptyCosting('GBP'), servings, items }
  const { rows, prices } = toCostInput(costing, () => null)
  const result = computeCost(rows, servings, prices, 'GBP')
  return { result, shopping: computeShopping(costing, result) }
}

describe('a part-used pack', () => {
  it('consumes a third of a tub but costs a whole one', () => {
    // 30 g of a 90 g tub at £1.80: the meal eats 60p, the till says £1.80.
    const { result, shopping } = run([item()])
    expect(result.totalMinor).toBe(60)
    expect(shopping.cookingMinor).toBe(60)
    expect(shopping.shoppingMinor).toBe(180)
    expect(shopping.leftoverMinor).toBe(120)
  })

  it('marks it as a part pack, which is the cupboard case', () => {
    expect(run([item()]).shopping.lines[0].partial).toBe(true)
  })

  it('costs nothing the second time, because the leftovers cover it', () => {
    // 60 g left of a 90 g tub, and the dish needs 30 g.
    expect(run([item()]).shopping.secondTimeMinor).toBe(0)
  })
})

describe('a pack used exactly', () => {
  it('charges one pack and leaves nothing behind', () => {
    const { shopping } = run([item({ useAmount: '90' })])
    expect(shopping.cookingMinor).toBe(180)
    expect(shopping.shoppingMinor).toBe(180)
    expect(shopping.leftoverMinor).toBe(0)
  })

  it('has to be bought again next time', () => {
    expect(run([item({ useAmount: '90' })]).shopping.secondTimeMinor).toBe(180)
  })

  it('is not a part pack', () => {
    expect(run([item({ useAmount: '90' })]).shopping.lines[0].partial).toBe(false)
  })
})

describe('more than one pack', () => {
  it('rounds up, because a shop does not sell a third of a tub', () => {
    // 100 g needs two 90 g tubs.
    const { shopping } = run([item({ useAmount: '100' })])
    expect(shopping.lines[0].packs).toBe(2)
    expect(shopping.shoppingMinor).toBe(360)
    expect(shopping.cookingMinor).toBe(200)
    expect(shopping.leftoverMinor).toBe(160)
  })

  it('buys one more next time, having 80 g in hand and needing 100', () => {
    expect(run([item({ useAmount: '100' })]).shopping.secondTimeMinor).toBe(180)
  })
})

describe('across a whole dish', () => {
  it('separates what is eaten from what is bought', () => {
    const { shopping } = run([
      item(), // 30 g of a 90 g tub — a store cupboard buy
      item({ label: 'rice', slug: 'rice', priceMinor: 179, packAmount: 1000, useAmount: '300' }),
      item({ label: 'onion', slug: 'onion', priceMinor: 95, packAmount: 3, packUnit: 'piece', useAmount: '2', useUnit: '' }),
    ])
    // Eaten: 60p + 53.7p + 63.3p. Bought: three whole packs.
    expect(shopping.cookingMinor).toBe(60 + 54 + 63)
    expect(shopping.shoppingMinor).toBe(180 + 179 + 95)
    expect(shopping.leftoverMinor).toBe(shopping.shoppingMinor - shopping.cookingMinor)
  })

  it('agrees with the calculator about what the dish consumes', () => {
    // The whole design rests on one shared number — if these ever drift, one of
    // the two figures on screen is lying.
    const { result, shopping } = run([item(), item({ label: 'rice', slug: 'rice', useAmount: '45' })])
    expect(shopping.cookingMinor).toBe(result.totalMinor)
  })

  it('names where the money is sitting', () => {
    const { shopping } = run([
      item(),
      item({ label: 'saffron', slug: 'saffron', priceMinor: 600, packAmount: 20, useAmount: '1' }),
    ])
    const worst = biggestLeftovers(shopping, 1)
    expect(worst[0].item).toBe('saffron')
    expect(worst[0].leftoverMinor).toBe(600 - 30)
  })
})

describe('what it will not report', () => {
  it('ignores a row with no price rather than counting it as free', () => {
    const { shopping } = run([item({ priceMinor: null })])
    expect(shopping.empty).toBe(true)
    expect(shopping.shoppingMinor).toBe(0)
  })

  it('ignores a row with no amount', () => {
    expect(run([item({ useAmount: null })]).shopping.empty).toBe(true)
  })

  it('reports an empty costing as empty rather than as free', () => {
    expect(run([]).shopping.empty).toBe(true)
  })

  it('does not round a pack up from floating-point dust', () => {
    // 3 × 30 g of a 90 g tub is exactly one pack, but in binary it is not.
    expect(run([item({ useAmount: '90' })]).shopping.lines[0].packs).toBe(1)
  })
})
