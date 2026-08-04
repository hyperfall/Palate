import { describe, expect, it, vi } from 'vitest'

import { computeCost } from '@/lib/cost'
import { preferredCurrency } from '@/lib/useCosting'
import { readShopCountry } from '@/lib/shopCountry'
import {
  displayName,
  emptyCosting,
  emptyItem,
  isWorthSaving,
  parseCosting,
  parseItem,
  toCostInput,
  useUnitsFor,
  withPrice,
  type CostingItem,
} from '@/lib/costing'

vi.mock('@/lib/shopCountry', () => ({ readShopCountry: vi.fn(() => null) }))
const chosenCountry = vi.mocked(readShopCountry)

/**
 * Reading costings out of untrusted JSON.
 *
 * Two sources feed this: a JSONB column and localStorage. Neither is under our
 * control at read time — an older draft, a hand-edited row, a half-written
 * write — and a costing page that throws on one bad row is worse than one that
 * drops it. The rule is: keep what can be shown, discard what cannot, never
 * invent.
 */

const item = (over: Partial<CostingItem> = {}): CostingItem => ({
  ...emptyItem('flour'),
  priceMinor: 250,
  packAmount: 500,
  packUnit: 'g',
  useAmount: '200',
  useUnit: 'g',
  ...over,
})

describe('parsing an item', () => {
  it('keeps a complete row', () => {
    const parsed = parseItem(item({ slug: 'flour' }))
    expect(parsed).toMatchObject({ label: 'flour', slug: 'flour', priceMinor: 250, packAmount: 500 })
  })

  it('keeps a half-filled row, because typing passes through that state', () => {
    const parsed = parseItem({ label: 'chorizo' })
    expect(parsed).toMatchObject({ label: 'chorizo', priceMinor: null, useAmount: null })
  })

  it('drops a row with no label — there is nothing to show or remove', () => {
    expect(parseItem({ priceMinor: 250 })).toBeNull()
    expect(parseItem({ label: '   ' })).toBeNull()
    expect(parseItem(null)).toBeNull()
    expect(parseItem('flour')).toBeNull()
  })

  it('refuses a price that would make an ingredient cost negative money', () => {
    expect(parseItem(item({ priceMinor: -50 }))?.priceMinor).toBeNull()
  })

  it('refuses a pack size of zero rather than dividing by it', () => {
    expect(parseItem(item({ packAmount: 0 }))?.packAmount).toBeNull()
    expect(parseItem(item({ packAmount: -5 }))?.packAmount).toBeNull()
  })

  it('refuses a pack unit it cannot convert', () => {
    expect(parseItem(item({ packUnit: 'furlong' as never }))?.packUnit).toBeNull()
  })

  it('reads a numeric string, because form fields produce strings', () => {
    expect(parseItem({ label: 'flour', priceMinor: '250', packAmount: '500' })).toMatchObject({
      priceMinor: 250,
      packAmount: 500,
    })
  })

  it('keeps the usage amount as typed', () => {
    // Not parsed to a number here — "1/2" is how recipes are written, and the
    // engine reads fractions. Converting at entry would lose what was typed.
    expect(parseItem(item({ useAmount: '1/2' }))?.useAmount).toBe('1/2')
  })
})

describe('parsing a costing', () => {
  it('reads a whole row', () => {
    const parsed = parseCosting({
      id: 'abc',
      name: "Dad's chilli",
      servings: 6,
      currency: 'GBP',
      items: [item()],
    })
    expect(parsed).toMatchObject({ id: 'abc', name: "Dad's chilli", servings: 6, currency: 'GBP' })
    expect(parsed?.items).toHaveLength(1)
  })

  it('accepts the database spelling of the recipe link', () => {
    // Supabase returns snake_case; the draft in localStorage is camelCase.
    expect(parseCosting({ items: [], source_recipe_slug: 'mapo-tofu' })?.sourceRecipeSlug).toBe(
      'mapo-tofu',
    )
    expect(parseCosting({ items: [], sourceRecipeSlug: 'mapo-tofu' })?.sourceRecipeSlug).toBe(
      'mapo-tofu',
    )
  })

  it('drops bad rows without losing the good ones', () => {
    const parsed = parseCosting({ items: [item(), null, { nope: 1 }, item({ label: 'rice' })] })
    expect(parsed?.items.map((i) => i.label)).toEqual(['flour', 'rice'])
  })

  it('falls back rather than trusting a nonsense servings count', () => {
    expect(parseCosting({ items: [], servings: 0 })?.servings).toBe(4)
    expect(parseCosting({ items: [], servings: 5000 })?.servings).toBe(4)
    expect(parseCosting({ items: [], servings: 'six' })?.servings).toBe(4)
  })

  it('falls back rather than trusting a currency it cannot format', () => {
    expect(parseCosting({ items: [], currency: 'XYZ' })?.currency).toBe('GBP')
    expect(parseCosting({ items: [], currency: 'eur' })?.currency).toBe('EUR')
  })

  it('caps the item count so one row cannot become a denial of service', () => {
    const many = Array.from({ length: 500 }, () => item())
    expect(parseCosting({ items: many })?.items.length).toBeLessThanOrEqual(60)
  })

  it('survives what is actually stored when nothing has been entered', () => {
    expect(parseCosting({ items: [] })?.items).toEqual([])
    expect(parseCosting(null)).toBeNull()
  })
})

describe('which units a row may use', () => {
  it('gives a catalogue row the full set, because we can convert', () => {
    expect(useUnitsFor(item({ slug: 'flour' }))).toContain('tbsp')
  })

  it('holds a free-text row to what it was bought in', () => {
    // "2 tbsp" of something bought by the kilo is unconvertible without a
    // density, so the engine would refuse it — and a row that empties after a
    // valid-looking entry reads as a bug.
    const units = useUnitsFor(item({ slug: null, packUnit: 'g' }))
    expect(units).toContain('g')
    expect(units).toContain('pack')
    expect(units).not.toContain('tbsp')
  })

  it('offers packs when a free-text row has no unit yet', () => {
    expect(useUnitsFor(emptyItem('chorizo'))).toEqual(['pack'])
  })
})

describe('feeding the engine', () => {
  const noMeasures = () => null

  it('prices each row from what that row records', () => {
    const costing = { ...emptyCosting('GBP'), items: [item({ slug: 'flour' })] }
    const { rows, prices } = toCostInput(costing, noMeasures)
    const result = computeCost(rows, 1, prices, 'GBP')
    expect(result.lines[0].minor).toBe(100)
  })

  it('keeps two free-text rows of the same name apart', () => {
    // Both called "oil" at different prices. Keyed by name alone, the second
    // would silently take the first's price.
    const costing = {
      ...emptyCosting('GBP'),
      items: [
        item({ label: 'oil', slug: null, priceMinor: 100, packAmount: 100, useAmount: '100' }),
        item({ label: 'oil', slug: null, priceMinor: 900, packAmount: 100, useAmount: '100' }),
      ],
    }
    const { rows, prices } = toCostInput(costing, noMeasures)
    const result = computeCost(rows, 1, prices, 'GBP')
    expect(result.lines.map((l) => l.minor)).toEqual([100, 900])
  })

  it('treats a pack as one of whatever was bought', () => {
    const costing = {
      ...emptyCosting('GBP'),
      items: [
        item({ slug: null, priceMinor: 350, packAmount: 1, packUnit: 'piece', useAmount: '2', useUnit: 'pack' }),
      ],
    }
    const { rows, prices } = toCostInput(costing, noMeasures)
    expect(computeCost(rows, 1, prices, 'GBP').lines[0].minor).toBe(700)
  })

  it('passes the catalogue measures through so conversions work', () => {
    const costing = {
      ...emptyCosting('GBP'),
      items: [
        item({ slug: 'garlic', priceMinor: 88, packAmount: 132, useAmount: '4', useUnit: '' }),
      ],
    }
    const { rows, prices } = toCostInput(costing, () => ({
      densityGPerMl: null,
      gramsPerPiece: 3,
    }))
    // 4 cloves × 3 g = 12 g of a 132 g pack at 88p = 8p.
    expect(computeCost(rows, 1, prices, 'GBP').lines[0].minor).toBe(8)
  })

  it('leaves an unpriced row unpriced rather than free', () => {
    const costing = { ...emptyCosting('GBP'), items: [item({ priceMinor: null })] }
    const { rows, prices } = toCostInput(costing, noMeasures)
    const result = computeCost(rows, 1, prices, 'GBP')
    expect(result.lines[0].minor).toBeNull()
    expect(result.totalMinor).toBe(0)
  })
})

describe('housekeeping', () => {
  it('does not offer to save an empty costing', () => {
    expect(isWorthSaving(emptyCosting())).toBe(false)
    expect(isWorthSaving({ ...emptyCosting(), items: [item()] })).toBe(true)
  })

  it('never lists a costing as blank', () => {
    expect(displayName(emptyCosting())).toBe('Untitled costing')
    expect(displayName({ ...emptyCosting(), name: '  ' })).toBe('Untitled costing')
    expect(displayName({ ...emptyCosting(), name: 'Chilli' })).toBe('Chilli')
  })

  it('seeds a row from a known price, including how it is measured', () => {
    const seeded = withPrice(emptyItem('eggs', 'egg'), {
      priceMinor: 180,
      currency: 'GBP',
      packAmount: 6,
      packUnit: 'piece',
    })
    expect(seeded).toMatchObject({ priceMinor: 180, packAmount: 6, packUnit: 'piece' })
    // Sold by the item, so the usage starts as a count and needs only a number.
    expect(seeded.useUnit).toBe('')
  })
})

describe('which currency a new costing starts in', () => {
  it('prefers a country the cook chose over one the edge guessed', () => {
    // A VPN, a holiday or a mis-geolocated ISP all produce a confident wrong
    // answer, and the footer picker exists precisely so it can be corrected.
    chosenCountry.mockReturnValue('DE')
    expect(preferredCurrency('US')).toBe('EUR')
  })

  it('falls back to what the edge detected', () => {
    chosenCountry.mockReturnValue(null)
    expect(preferredCurrency('JP')).toBe('JPY')
    expect(preferredCurrency('IE')).toBe('EUR')
  })

  it('falls back to the currency our own estimates are in', () => {
    // The only one usable without inventing an exchange rate.
    chosenCountry.mockReturnValue(null)
    expect(preferredCurrency(null)).toBe('GBP')
    expect(preferredCurrency()).toBe('GBP')
  })

  it('ignores a country it cannot map', () => {
    chosenCountry.mockReturnValue(null)
    expect(preferredCurrency('ZZ')).toBe('GBP')
  })
})
