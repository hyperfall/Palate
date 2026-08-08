import { describe, expect, it } from 'vitest'

import { formatMeasure } from '@/lib/measure'

const at = (quantity: string | null, unit: string | null, factor = 1) =>
  formatMeasure({ quantity, unit, item: 'x' } as never, { factor, unitSystem: 'us' } as never)

describe('formatMeasure', () => {
  it('reads a fraction as the recipe means it, not as parseFloat truncates it', () => {
    // The bug: parseFloat("1/2") is 1, so the recipe page and cook mode told a
    // reader to use double. These are the amounts a cook actually follows.
    expect(at('1/2', 'cup')).toBe('½ cup')
    expect(at('3/4', 'cup')).toBe('¾ cup')
    expect(at('1 1/2', 'cup')).toBe('1½ cup')
  })

  it('scales a fraction correctly', () => {
    expect(at('3/4', 'cup', 2)).toBe('1½ cup')
  })

  it('leaves whole numbers alone', () => {
    expect(at('2', 'cup')).toBe('2 cup')
  })

  it('leaves an unparseable amount verbatim rather than scaling a lie', () => {
    expect(at('a handful', null)).toBe('a handful')
  })
})

describe('scaling a spoon measure down', () => {
  const tsp = (quantity: string) => ({ quantity, unit: 'tsp' })

  it('lands on an eighth rather than a two-decimal number', () => {
    // Weeknight Shakshuka serves 4 with 1/4 tsp cayenne. Halved, that is an
    // eighth — a real spoon. It used to print "0.13 tsp".
    expect(formatMeasure(tsp('1/4'), { factor: 0.5, unitSystem: 'metric' })).toBe('⅛ tsp')
  })

  it('says what a cook says once it is below the smallest spoon', () => {
    // The same recipe scaled to one serving: a sixteenth of a teaspoon. No
    // kitchen tool produces that, and "0.06 tsp" is not an instruction.
    expect(formatMeasure(tsp('1/4'), { factor: 0.25, unitSystem: 'metric' })).toBe('a pinch')
    expect(formatMeasure(tsp('1/2'), { factor: 0.125, unitSystem: 'metric' })).toBe('a pinch')
  })

  it('leaves a measurable spoonful alone', () => {
    expect(formatMeasure(tsp('1'), { factor: 1, unitSystem: 'metric' })).toBe('1 tsp')
    expect(formatMeasure(tsp('1/2'), { factor: 1, unitSystem: 'metric' })).toBe('½ tsp')
    expect(formatMeasure(tsp('3'), { factor: 0.5, unitSystem: 'metric' })).toBe('1½ tsp')
  })

  it('does not turn a weight into a pinch', () => {
    // A scale reads small numbers perfectly well; only spoons have a floor.
    expect(formatMeasure({ quantity: '1', unit: 'g' }, { factor: 0.03, unitSystem: 'metric' })).toBe(
      '0.03 g',
    )
  })

  it('never reduces a countable ingredient to a pinch', () => {
    expect(
      formatMeasure(
        { quantity: '1', unit: 'tsp', ingredient: { countable: true } },
        { factor: 0.01, unitSystem: 'metric' },
      ),
    ).toBe('1 tsp')
  })
})
