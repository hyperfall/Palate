import { describe, expect, it } from 'vitest'
import { quantityRangeError, validateRecipeNumbers } from '@/lib/recipeLimits'

const valid = {
  servings: 4,
  prepMinutes: 15,
  cookMinutes: 40,
  spiciness: 2,
  sweetness: 1,
  richness: 3,
  effort: 2,
  ingredients: [{ quantity: '2' }, { quantity: '1/2' }, { quantity: '2-3' }],
}

describe('validateRecipeNumbers', () => {
  it('accepts a realistic recipe', () => {
    expect(validateRecipeNumbers(valid)).toBeNull()
  })

  it('accepts the generous ceilings', () => {
    expect(validateRecipeNumbers({ ...valid, servings: 100, prepMinutes: 2880, cookMinutes: 2880 })).toBeNull()
  })

  it('rejects zero / oversized servings', () => {
    expect(validateRecipeNumbers({ ...valid, servings: 0 })).toMatch(/Servings/)
    expect(validateRecipeNumbers({ ...valid, servings: 999999 })).toMatch(/Servings/)
  })

  it('rejects negative and absurd times', () => {
    expect(validateRecipeNumbers({ ...valid, cookMinutes: -5 })).toMatch(/Cook time/)
    expect(validateRecipeNumbers({ ...valid, prepMinutes: 100000 })).toMatch(/Prep time/)
  })

  it('rejects non-integer numbers', () => {
    expect(validateRecipeNumbers({ ...valid, servings: 2.5 })).toMatch(/Servings/)
  })

  it('rejects NaN / Infinity / non-numbers', () => {
    expect(validateRecipeNumbers({ ...valid, servings: Number.NaN })).toMatch(/Servings/)
    expect(validateRecipeNumbers({ ...valid, cookMinutes: Number.POSITIVE_INFINITY })).toMatch(/Cook time/)
    expect(validateRecipeNumbers({ ...valid, servings: '4' as unknown as number })).toMatch(/Servings/)
  })

  it('rejects out-of-range taste ratings', () => {
    expect(validateRecipeNumbers({ ...valid, richness: 6 })).toMatch(/Taste/)
    expect(validateRecipeNumbers({ ...valid, spiciness: -1 })).toMatch(/Taste/)
  })

  it('rejects an absurd ingredient quantity', () => {
    expect(validateRecipeNumbers({ ...valid, ingredients: [{ quantity: '999999' }] })).toMatch(/quantities/)
  })
})

describe('quantityRangeError', () => {
  it('passes normal, fractional, and range quantities', () => {
    expect(quantityRangeError('2')).toBeNull()
    expect(quantityRangeError('1/2')).toBeNull()
    expect(quantityRangeError('2-3')).toBeNull()
    expect(quantityRangeError('1.5')).toBeNull()
    expect(quantityRangeError('')).toBeNull()
    expect(quantityRangeError(undefined)).toBeNull()
  })

  it('flags a number over the ceiling', () => {
    expect(quantityRangeError('10001')).toMatch(/exceed/)
    expect(quantityRangeError('3-99999')).toMatch(/exceed/)
  })
})
