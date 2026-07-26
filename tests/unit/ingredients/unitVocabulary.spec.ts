import { describe, expect, it } from 'vitest'

import { CANONICAL_UNITS, filterUnits } from '@/components/IngredientRowsInput'
import { parseIngredientLine } from '@/lib/ingredients/parse'

/**
 * The studio unit picker must only offer units the rest of the platform can act
 * on — the old native datalist listed things like "pint", "fl oz", and "piece"
 * that the parser drops and the nutrition engine can't turn into grams.
 */
describe('studio unit vocabulary', () => {
  it('offers only units the parser recognises — every one round-trips', () => {
    for (const u of CANONICAL_UNITS) {
      expect(parseIngredientLine(`1 ${u} salt`).unit).toBe(u)
    }
  })

  it('drops the unparseable entries the old datalist offered', () => {
    for (const bad of ['pint', 'fl oz', 'quart', 'gallon', 'piece', 'teaspoon', 'to taste']) {
      expect(CANONICAL_UNITS).not.toContain(bad)
    }
  })

  it('is metric-first', () => {
    expect(CANONICAL_UNITS.slice(0, 2)).toEqual(['g', 'kg'])
  })

  it('filters by substring; empty query returns the whole list', () => {
    expect(filterUnits('k')).toEqual(['kg', 'stick', 'knob']) // all contain "k"
    expect(filterUnits('  TBSP ')).toEqual(['tbsp'])
    expect(filterUnits('')).toEqual(CANONICAL_UNITS)
  })
})
