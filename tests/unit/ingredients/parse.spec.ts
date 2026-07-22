import { describe, expect, it } from 'vitest'
import { parseIngredientLine } from '@/lib/ingredients/parse'

describe('parseIngredientLine', () => {
  it('splits number + unit + item', () => {
    expect(parseIngredientLine('2 tbsp olive oil')).toEqual({ quantity: '2', unit: 'tbsp', item: 'olive oil' })
    expect(parseIngredientLine('1 tsp ground cumin')).toEqual({ quantity: '1', unit: 'tsp', item: 'ground cumin' })
  })
  it('handles a unit glued to the number (400g)', () => {
    expect(parseIngredientLine('50g feta, crumbled')).toEqual({ quantity: '50', unit: 'g', item: 'feta, crumbled' })
  })
  it('handles fractions and mixed numbers', () => {
    expect(parseIngredientLine('1/2 tsp salt')).toEqual({ quantity: '1/2', unit: 'tsp', item: 'salt' })
    expect(parseIngredientLine('1 1/2 cups flour')).toEqual({ quantity: '1 1/2', unit: 'cup', item: 'flour' })
    expect(parseIngredientLine('½ tsp vanilla')).toEqual({ quantity: '1/2', unit: 'tsp', item: 'vanilla' })
  })
  it('handles ranges', () => {
    expect(parseIngredientLine('2-3 tbsp water')).toEqual({ quantity: '2–3', unit: 'tbsp', item: 'water' })
  })
  it('normalises plural units to canonical', () => {
    expect(parseIngredientLine('3 cloves garlic, minced')).toEqual({ quantity: '3', unit: 'clove', item: 'garlic, minced' })
  })
  it('leaves a count with no unit as quantity + item', () => {
    expect(parseIngredientLine('4 large eggs')).toEqual({ quantity: '4', item: 'large eggs' })
    expect(parseIngredientLine('1 red bell pepper, sliced')).toEqual({ quantity: '1', item: 'red bell pepper, sliced' })
  })
  it('does NOT invent a unit from a non-unit first word', () => {
    expect(parseIngredientLine('salt to taste')).toEqual({ item: 'salt to taste' })
  })
  it('handles an informal unit with no number', () => {
    expect(parseIngredientLine('handful fresh cilantro, chopped')).toEqual({ unit: 'handful', item: 'fresh cilantro, chopped' })
  })
  it('strips a leading "of" left after a unit', () => {
    expect(parseIngredientLine('1 stick of butter')).toEqual({ quantity: '1', unit: 'stick', item: 'butter' })
  })
  it('is robust to blank / messy input', () => {
    expect(parseIngredientLine('   ')).toEqual({ item: '' })
    expect(parseIngredientLine('  2   tbsp   olive oil ')).toEqual({ quantity: '2', unit: 'tbsp', item: 'olive oil' })
  })
})
