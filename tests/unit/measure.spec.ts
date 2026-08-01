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
