import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CostingEditor, type CalculatorIngredient } from '@/components/calculator/CostingEditor'
import { emptyCosting, emptyItem, type Costing } from '@/lib/costing'

/**
 * The calculator, as a reader meets it.
 *
 * The version this replaces showed an amount and a total and hid the price
 * behind a link, so the total looked like it arrived from nowhere. The
 * assertions that matter here are therefore about what is VISIBLE on a row:
 * both facts, always, and the arithmetic between them.
 *
 * Supabase is stubbed out entirely — signed out is a first-class state for this
 * feature, and it is also the one that needs no fixtures.
 */

vi.mock('@/lib/supabase/client', () => ({ supabaseBrowser: () => null }))

const garlic: CalculatorIngredient = {
  slug: 'garlic',
  name: 'garlic',
  category: 'produce',
  image: null,
  densityGPerMl: null,
  gramsPerPiece: 3,
  baseline: { priceMinor: 88, packAmount: 132, packUnit: 'g', currency: 'GBP' },
}

const unpriced: CalculatorIngredient = {
  ...garlic,
  slug: 'rosemary',
  name: 'rosemary',
  baseline: null,
}

function costingWith(...items: Costing['items']): Costing {
  return { ...emptyCosting('GBP'), items }
}

const priced = (over: Partial<Costing['items'][number]> = {}) => ({
  ...emptyItem('garlic', 'garlic'),
  priceMinor: 88,
  packAmount: 132,
  packUnit: 'g' as const,
  useAmount: '100',
  useUnit: 'g',
  ...over,
})

const renderEditor = (costing: Costing, ingredients = [garlic, unpriced]) =>
  render(<CostingEditor initial={costing} ingredients={ingredients} />)

afterEach(cleanup)

describe('a row shows its working', () => {
  it('puts both what you paid and what you use on the row', () => {
    renderEditor(costingWith(priced()))

    expect(screen.getByLabelText('What you paid for garlic')).toHaveProperty('value', '0.88')
    expect(screen.getByLabelText('How much you got for that, for garlic')).toHaveProperty(
      'value',
      '132',
    )
    expect(screen.getByLabelText('How much garlic the dish uses')).toHaveProperty('value', '100')
  })

  it('names the ingredient on the row', () => {
    // It vanished entirely in the previous build — the select was w-full and
    // squeezed the truncating name column to nothing.
    renderEditor(costingWith(priced()))
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('garlic')).toBeTruthy()
  })

  it('costs the amount against the pack', () => {
    // 100 g of a 132 g pack costing 88p = 67p.
    renderEditor(costingWith(priced()))
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('£0.67')).toBeTruthy()
  })

  it('recomputes when the price is corrected', () => {
    renderEditor(costingWith(priced()))
    fireEvent.change(screen.getByLabelText('What you paid for garlic'), {
      target: { value: '1.32' },
    })
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    // 100 g of a 132 g pack now costing £1.32 = £1.00.
    expect(within(row).getByText('£1.00')).toBeTruthy()
  })

  it('recomputes when the amount changes', () => {
    renderEditor(costingWith(priced()))
    fireEvent.change(screen.getByLabelText('How much garlic the dish uses'), {
      target: { value: '66' },
    })
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('£0.44')).toBeTruthy()
  })

  it('converts a count through the per-piece weight', () => {
    // 4 cloves × 3 g = 12 g of a 132 g pack at 88p = 8p. The catalogue knows a
    // garlic "piece" is a clove; a per-bulb price would charge four bulbs.
    renderEditor(costingWith(priced({ useAmount: '4', useUnit: '' })))
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('£0.08')).toBeTruthy()
  })
})

describe('whose number it is', () => {
  it('offers our estimate rather than adopting it silently', () => {
    renderEditor(costingWith(emptyItem('garlic', 'garlic')))
    const suggestion = screen.getByText(/ours: £0\.88 \/ 132g/)
    expect(suggestion).toBeTruthy()
    // Not applied until asked for — the row must say whose number it is.
    expect(screen.getByLabelText('What you paid for garlic')).toHaveProperty('value', '')
  })

  it('applies the estimate when tapped', () => {
    renderEditor(costingWith(emptyItem('garlic', 'garlic')))
    fireEvent.click(screen.getByText(/ours: £0\.88 \/ 132g/))
    expect(screen.getByLabelText('What you paid for garlic')).toHaveProperty('value', '0.88')
  })

  it('has nothing to suggest for an ingredient we never priced', () => {
    renderEditor(costingWith(emptyItem('rosemary', 'rosemary')))
    expect(screen.queryByText(/^ours:/)).toBeNull()
  })
})

describe('things we do not stock', () => {
  it('lets you add whatever you typed', () => {
    renderEditor(costingWith())
    fireEvent.change(screen.getByLabelText('Search the ingredient catalogue'), {
      target: { value: 'chorizo' },
    })
    fireEvent.click(screen.getByText(/Add “chorizo”/))
    expect(screen.getByLabelText('How much chorizo the dish uses')).toBeTruthy()
  })

  it('holds a typed row to the unit it was bought in', () => {
    // Without a density, "2 tbsp" of something bought by weight is
    // unconvertible — so the option is not offered rather than explained.
    renderEditor(costingWith({ ...emptyItem('chorizo'), packUnit: 'g' }))
    const select = screen.getByLabelText('Unit for chorizo') as HTMLSelectElement
    const options = [...select.options].map((o) => o.value)
    expect(options).toContain('g')
    expect(options).toContain('pack')
    expect(options).not.toContain('tbsp')
  })

  it('says a typed row is not kept in your prices', () => {
    renderEditor(costingWith(emptyItem('chorizo')))
    const row = screen.getByLabelText('How much chorizo the dish uses').closest('li')!
    expect(within(row).getByText(/not saved to your prices/)).toBeTruthy()
  })

  it('gives a catalogue row the full set of units', () => {
    renderEditor(costingWith(priced()))
    const select = screen.getByLabelText('Unit for garlic') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toContain('tbsp')
  })
})

describe('the total', () => {
  const totals = () => screen.getByText('What it comes to').parentElement!

  it('divides by servings', () => {
    renderEditor(costingWith(priced()))
    // 67p over the default 4 servings.
    expect(within(totals()).getByText('£0.67')).toBeTruthy()
    expect(within(totals()).getByText('£0.17')).toBeTruthy()
  })

  it('follows the servings control', () => {
    renderEditor(costingWith(priced()))
    fireEvent.change(screen.getByLabelText('Serves'), { target: { value: '2' } })
    expect(within(totals()).getByText('£0.34')).toBeTruthy()
  })

  it('admits when it is short rather than looking complete', () => {
    // A total built from one of two ingredients looks identical to a finished
    // one unless it says so.
    renderEditor(costingWith(priced(), priced({ label: 'rosemary', slug: 'rosemary', priceMinor: null })))
    expect(screen.getByText(/still without a price/)).toBeTruthy()
  })

  it('drops a removed row out of the total', () => {
    renderEditor(costingWith(priced()))
    fireEvent.click(screen.getByLabelText('Remove garlic'))
    expect(screen.queryByLabelText('How much garlic the dish uses')).toBeNull()
    expect(within(totals()).getAllByText('£0.00')).toHaveLength(2)
  })
})

describe('signed out', () => {
  it('still calculates, and says what signing in would add', () => {
    renderEditor(costingWith(priced()))
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('£0.67')).toBeTruthy()
    expect(screen.getByText(/to name and keep this/)).toBeTruthy()
  })
})

describe('serves label', () => {
  it('is reachable by its label', () => {
    renderEditor(costingWith(priced()))
    expect(screen.getByLabelText('Serves')).toBeTruthy()
  })
})
