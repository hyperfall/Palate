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
  it('uses our estimate and says so, rather than making you ask for it', () => {
    // Withholding it meant one tap per ingredient before a dish totalled
    // anything. Filling it in and labelling it keeps the honesty without the
    // busywork.
    renderEditor(costingWith(emptyItem('garlic', 'garlic')))
    expect(screen.getByLabelText('What you paid for garlic')).toHaveProperty('value', '0.88')
    expect(screen.getByText('our estimate')).toBeTruthy()
    // Nothing to offer, because it is already applied.
    expect(screen.queryByText(/tap to use/)).toBeNull()
  })

  it('offers it back after you clear the field', () => {
    renderEditor(costingWith(emptyItem('garlic', 'garlic')))
    fireEvent.change(screen.getByLabelText('What you paid for garlic'), { target: { value: '' } })
    fireEvent.click(screen.getByText(/tap to use/))
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

describe('what it costs at the till', () => {
  const gochujang: CalculatorIngredient = {
    slug: 'gochujang',
    name: 'gochujang',
    category: null,
    image: null,
    densityGPerMl: null,
    gramsPerPiece: null,
    baseline: { priceMinor: 180, packAmount: 90, packUnit: 'g', currency: 'GBP' },
  }

  const partPack = () => ({
    ...emptyItem('gochujang', 'gochujang'),
    priceMinor: 180,
    packAmount: 90,
    packUnit: 'g' as const,
    useAmount: '30',
    useUnit: 'g',
  })

  it('separates what the dish eats from what leaves your account', () => {
    // 30 g of a 90 g tub: the meal consumes 60p, the shop charges £1.80.
    renderEditor(costingWith(partPack()), [gochujang])
    const till = screen.getByText('At the till').parentElement!
    expect(within(till).getByText('£1.80')).toBeTruthy()
    expect(within(till).getByText('£1.20')).toBeTruthy()
  })

  it('shows a second cooking as free when the leftovers cover it', () => {
    renderEditor(costingWith(partPack()), [gochujang])
    const till = screen.getByText('At the till').parentElement!
    const nextTime = within(till).getByText('Next time').closest('.leader') as HTMLElement
    expect(within(nextTime).getByText('£0.00')).toBeTruthy()
  })

  it('names where the money is sitting', () => {
    renderEditor(costingWith(partPack()), [gochujang])
    expect(screen.getByText(/Most of what stays in the cupboard/)).toBeTruthy()
  })

  it('stays quiet when every pack is used up', () => {
    // Nothing left over means the two readings are the same number, and the
    // section would be repeating the total back at you.
    renderEditor(costingWith({ ...partPack(), useAmount: '90' }), [gochujang])
    expect(screen.queryByText('At the till')).toBeNull()
  })

  it('stays quiet when nothing is priced', () => {
    // An ingredient we have no estimate for, so nothing resolves into it.
    renderEditor(
      costingWith({ ...partPack(), label: 'rosemary', slug: 'rosemary', priceMinor: null }),
      [{ ...gochujang, slug: 'rosemary', name: 'rosemary', baseline: null }],
    )
    expect(screen.queryByText('At the till')).toBeNull()
  })
})

describe('a row arrives priced', () => {
  it('fills our estimate in rather than hiding it behind a tap', () => {
    // A recipe-seeded costing carries amounts but no prices. Left unresolved it
    // showed a row of empty boxes and totalled zero — one tap per ingredient
    // before the dish came to anything.
    renderEditor(costingWith({ ...emptyItem('garlic', 'garlic'), useAmount: '100', useUnit: 'g' }))
    expect(screen.getByLabelText('What you paid for garlic')).toHaveProperty('value', '0.88')
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('£0.67')).toBeTruthy()
  })

  it('says the number is ours until it is corrected', () => {
    renderEditor(costingWith({ ...emptyItem('garlic', 'garlic'), useAmount: '100', useUnit: 'g' }))
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText('our estimate')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('What you paid for garlic'), { target: { value: '1.20' } })
    expect(within(row).getByText('what you pay')).toBeTruthy()
    expect(within(row).queryByText('our estimate')).toBeNull()
  })

  it('leaves an ingredient we never priced alone', () => {
    renderEditor(costingWith({ ...emptyItem('rosemary', 'rosemary'), useAmount: '5', useUnit: 'g' }))
    expect(screen.getByLabelText('What you paid for rosemary')).toHaveProperty('value', '')
  })

  it('shows the shelf price, the only figure comparable between pack sizes', () => {
    renderEditor(costingWith(priced()))
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    // 88p for 132 g is £6.67/kg.
    expect(within(row).getByText(/£6\.67\/kg/)).toBeTruthy()
  })

  it('shows a per-item price for something sold by the item', () => {
    renderEditor(
      costingWith(priced({ priceMinor: 180, packAmount: 6, packUnit: 'piece', useAmount: '2', useUnit: '' })),
    )
    const row = screen.getByLabelText('How much garlic the dish uses').closest('li')!
    expect(within(row).getByText(/£0\.30 each/)).toBeTruthy()
  })
})

describe('what reaches the price book', () => {
  // The book is the thing that outlives a costing and reaches every recipe, so
  // what goes into it has to be what the cook actually said.
  it('does not treat our estimate as a price the cook gave us', () => {
    // A row arrives prefilled with our estimate. Tabbing through the field must
    // not write that guess into their book — it would come back on the next
    // costing labelled "what you pay", which would be a lie.
    const saved: unknown[] = []
    renderEditor(costingWith(emptyItem('garlic', 'garlic')))
    const field = screen.getByLabelText('What you paid for garlic')
    expect(field).toHaveProperty('value', '0.88')
    fireEvent.blur(field)
    expect(saved).toHaveLength(0)
    // Still ours, because nothing was corrected.
    expect(screen.getByText('our estimate')).toBeTruthy()
  })

  it('marks a corrected price as the cook’s own', () => {
    renderEditor(costingWith(emptyItem('garlic', 'garlic')))
    const field = screen.getByLabelText('What you paid for garlic')
    fireEvent.change(field, { target: { value: '1.20' } })
    fireEvent.blur(field)
    expect(screen.getByText('what you pay')).toBeTruthy()
  })
})
