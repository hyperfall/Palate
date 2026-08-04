import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CostCalculator, type CalculatorIngredient } from '@/components/CostCalculator'

/**
 * The calculator's row, which shipped broken.
 *
 * The house Select is `w-full`. As a direct flex child that resolves against
 * the row, so it claimed the whole width and squeezed the name column — which
 * carries `truncate` — down to nothing. The ingredient's name disappeared
 * entirely, leaving a row of controls with no indication of what they applied
 * to, and the unit dropdown stretched across the page.
 *
 * jsdom does not do layout, so none of these assertions can catch the widths
 * directly. What they can pin down is the structure that caused it: the select
 * must stay inside a sized box rather than sit loose in the row, and the name
 * must actually render. Both were wrong, and both are cheap to assert.
 */

vi.mock('@/lib/supabase/client', () => ({ supabaseBrowser: () => null }))

const ingredient = (over: Partial<CalculatorIngredient> = {}): CalculatorIngredient => ({
  slug: 'garlic',
  name: 'garlic',
  category: 'produce',
  image: null,
  densityGPerMl: null,
  gramsPerPiece: 3,
  baseline: { priceMinor: 88, packAmount: 132, packUnit: 'g', currency: 'GBP' },
  ...over,
})

function addFirstMatch(query: string) {
  const search = screen.getByLabelText('Search the ingredient catalogue')
  fireEvent.change(search, { target: { value: query } })
  const option = screen.getAllByRole('button').find((b) => b.textContent?.includes(query))
  if (!option) throw new Error(`no suggestion matching ${query}`)
  fireEvent.click(option)
}

afterEach(cleanup)

describe('adding an ingredient', () => {
  it('shows the ingredient name on its row', () => {
    // The bug: the name rendered into a zero-width truncating box, so the row
    // read as an anonymous set of controls.
    render(<CostCalculator ingredients={[ingredient()]} />)
    addFirstMatch('garlic')

    expect(screen.getByLabelText('How much garlic')).toBeTruthy()
    const row = screen.getByLabelText('How much garlic').closest('li')!
    expect(within(row).getByText('garlic')).toBeTruthy()
  })

  it('keeps the unit select inside a width-constrained box', () => {
    render(<CostCalculator ingredients={[ingredient()]} />)
    addFirstMatch('garlic')

    const select = screen.getByLabelText('Unit for garlic')
    const box = select.parentElement!
    // The house Select is w-full by design; the guard is that it always has a
    // sized parent, never the flex row itself.
    expect(select.className).toContain('w-full')
    expect(box.className).toMatch(/\bw-\d+\b/)
  })

  it('shows the baseline price in the unit it is sold in, not shouted', () => {
    render(<CostCalculator ingredients={[ingredient()]} />)
    addFirstMatch('garlic')

    const row = screen.getByLabelText('How much garlic').closest('li')!
    const priceButton = within(row)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('£0.88'))!
    expect(priceButton.textContent).toContain('132g')
    // uppercase would render "132G", which is not a unit anybody writes.
    expect(priceButton.className).not.toContain('uppercase')
  })
})

describe('totalling', () => {
  it('costs an amount against the pack and divides by servings', () => {
    render(<CostCalculator ingredients={[ingredient()]} />)
    addFirstMatch('garlic')

    // 100 g of a 132 g pack costing 88p = 67p; over the default 4 servings, 17p.
    fireEvent.change(screen.getByLabelText('How much garlic'), { target: { value: '100' } })

    // Scoped, because with a single ingredient the line and the total are the
    // same number — and asserting them separately is the point.
    const row = screen.getByLabelText('How much garlic').closest('li')!
    expect(within(row).getByText('£0.67')).toBeTruthy()

    const totals = screen.getByText('What it comes to').parentElement!
    expect(within(totals).getByText('£0.67')).toBeTruthy()
    expect(within(totals).getByText('£0.17')).toBeTruthy()
  })

  it('says nothing rather than zero before an amount is typed', () => {
    render(<CostCalculator ingredients={[ingredient()]} />)
    addFirstMatch('garlic')

    const row = screen.getByLabelText('How much garlic').closest('li')!
    expect(within(row).getByTitle('Type an amount')).toBeTruthy()
  })

  it('marks an ingredient it has no price for', () => {
    render(<CostCalculator ingredients={[ingredient({ baseline: null })]} />)
    addFirstMatch('garlic')
    fireEvent.change(screen.getByLabelText('How much garlic'), { target: { value: '100' } })

    const row = screen.getByLabelText('How much garlic').closest('li')!
    expect(within(row).getByTitle('No price recorded for this ingredient')).toBeTruthy()
  })
})

describe('removing', () => {
  it('takes the line out of the total', () => {
    render(<CostCalculator ingredients={[ingredient()]} />)
    addFirstMatch('garlic')
    fireEvent.change(screen.getByLabelText('How much garlic'), { target: { value: '100' } })
    const totals = screen.getByText('What it comes to').parentElement!
    expect(within(totals).getByText('£0.67')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Remove garlic'))
    expect(screen.queryByLabelText('How much garlic')).toBeNull()
    expect(screen.getByText('Nothing added yet', { exact: false })).toBeTruthy()
    // Both the total and the per-plate figure fall back to zero, which is the
    // honest reading of an empty list — there is nothing to be uncertain about.
    expect(within(totals).getAllByText('£0.00')).toHaveLength(2)
  })
})
