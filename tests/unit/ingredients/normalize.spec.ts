// tests/unit/ingredients/normalize.spec.ts
import { describe, expect, it } from 'vitest'
import { normalizeItem, singularize } from '@/lib/ingredients/normalize'

describe('singularize', () => {
  it('handles common English plurals', () => {
    expect(singularize('tomatoes')).toBe('tomato')
    expect(singularize('cloves')).toBe('clove')
    expect(singularize('berries')).toBe('berry')
    expect(singularize('glasses')).toBe('glass') // -ses keeps one s
    expect(singularize('molasses')).toBe('molasses') // -ss unchanged
  })
})

describe('normalizeItem', () => {
  it('lowercases, trims, collapses whitespace', () => {
    expect(normalizeItem('  Olive   Oil ')).toBe('olive oil')
  })
  it('drops parentheticals and post-comma qualifiers', () => {
    expect(normalizeItem('butter (unsalted), softened')).toBe('butter')
    expect(normalizeItem('garlic, minced')).toBe('garlic')
  })
  it('strips a leading quantity + unit so the name is the ingredient, not the measure', () => {
    expect(normalizeItem('2 tbsp olive oil')).toBe('olive oil')
    expect(normalizeItem('tbsp olive oil')).toBe('olive oil')
    expect(normalizeItem('400 g crushed tomatoes')).toBe('tomato')
    expect(normalizeItem('3 cloves garlic')).toBe('garlic')
    expect(normalizeItem('1 tsp ground cumin')).toBe('cumin')
    expect(normalizeItem('50g feta')).toBe('feta')
  })
  it('collapses a trailing count-unit to the base ingredient (item-first phrasing)', () => {
    expect(normalizeItem('3 garlic cloves')).toBe('garlic')
    expect(normalizeItem('garlic cloves, minced')).toBe('garlic')
    expect(normalizeItem('thyme sprigs')).toBe('thyme')
    expect(normalizeItem('2 celery stalks')).toBe('celery')
    expect(normalizeItem('4 sprigs thyme')).toBe('thyme') // leading unit path still works
    expect(normalizeItem('ground cloves')).toBe('clove') // the spice, alone, survives
  })
  it('strips leading/trailing descriptors', () => {
    expect(normalizeItem('extra-virgin olive oil')).toBe('olive oil')
    expect(normalizeItem('freshly ground black pepper')).toBe('black pepper')
    expect(normalizeItem('2 large ripe tomatoes')).toBe('tomato')
  })
  it('drops trailing "to taste" / "for garnish" / "plus more"', () => {
    expect(normalizeItem('salt to taste')).toBe('salt')
    expect(normalizeItem('cilantro, for garnish')).toBe('cilantro')
    expect(normalizeItem('flour, plus more for dusting')).toBe('flour')
  })
  it('folds accents so an accented name matches its ascii twin', () => {
    expect(normalizeItem('tomato purée')).toBe('tomato puree')
    expect(normalizeItem('jalapeño')).toBe('jalapeno')
    expect(normalizeItem('crème fraîche')).toBe('creme fraiche')
    // and it no longer punches a hole mid-word ("pur e")
    expect(normalizeItem('tomato purée')).not.toContain(' e')
  })
  it('returns empty string for junk', () => {
    expect(normalizeItem('   ')).toBe('')
  })
})
