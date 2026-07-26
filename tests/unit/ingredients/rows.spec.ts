import { describe, expect, it } from 'vitest'

import { classifyIngredientRow, foldIngredientRows, mergePastedRow } from '@/lib/ingredients/rows'

describe('mergePastedRow', () => {
  it('keeps a typed quantity and unit when the pasted line carries none', () => {
    // The studio bug: type 2 / tbsp, paste "olive oil", lose the 2 tbsp.
    const out = mergePastedRow({ quantity: '2', unit: 'tbsp', item: '' }, { quantity: '', unit: '', item: 'olive oil' })
    expect(out).toEqual({ quantity: '2', unit: 'tbsp', item: 'olive oil' })
  })

  it('lets a pasted measure win — that paste meant to replace the line', () => {
    const out = mergePastedRow(
      { quantity: '2', unit: 'tbsp', item: '' },
      { quantity: '400', unit: 'g', item: 'tinned tomatoes' },
    )
    expect(out).toEqual({ quantity: '400', unit: 'g', item: 'tinned tomatoes' })
  })

  it('keeps the existing name when the paste has none', () => {
    const out = mergePastedRow({ quantity: '', unit: '', item: 'garlic' }, { quantity: '3', unit: '', item: '' })
    expect(out).toEqual({ quantity: '3', unit: '', item: 'garlic' })
  })
})

describe('classifyIngredientRow', () => {
  it('treats a bare participle phrase as a qualifier', () => {
    for (const q of ['cut in half', 'quartered', 'chopped', 'finely chopped', 'cut into small wedges']) {
      expect(classifyIngredientRow(q)).toBe('qualifier')
    }
  })

  it('does NOT mistake a real ingredient that starts with a participle', () => {
    // The exact trap: "grated" starts a qualifier, but "grated mozzarella" is food.
    for (const i of ['grated mozzarella', 'chopped tomatoes', 'sliced almonds', 'crushed ice']) {
      expect(classifyIngredientRow(i)).toBe('ingredient')
    }
  })

  it('reads parentheticals and standalone instructions as qualifiers', () => {
    expect(classifyIngredientRow('(available online), stem and seeds removed')).toBe('qualifier')
    expect(classifyIngredientRow('(ask your butcher)')).toBe('qualifier')
    expect(classifyIngredientRow('to taste')).toBe('qualifier')
  })

  it('recognises section labels', () => {
    for (const h of ['To serve', 'For the sauce', 'To garnish', 'For the marinade:', 'Toppings']) {
      expect(classifyIngredientRow(h)).toBe('heading')
    }
  })

  it('leaves ordinary ingredients alone', () => {
    for (const i of ['spicy salsa', 'sunflower oil', 'braising steak', 'bay leaves']) {
      expect(classifyIngredientRow(i)).toBe('ingredient')
    }
  })
})

describe('foldIngredientRows', () => {
  it('folds qualifiers into the ingredient above and flags headings', () => {
    const out = foldIngredientRows([
      { quantity: '2', unit: '', item: 'medium tomatoes' },
      { quantity: '', unit: '', item: 'cut in half' },
      { quantity: '1', unit: '', item: 'medium onion' },
      { quantity: '', unit: '', item: 'quartered' },
      { quantity: '', unit: '', item: 'To serve' },
      { quantity: '', unit: '', item: 'spicy salsa' },
    ])
    expect(out.map((r) => r.item)).toEqual([
      'medium tomatoes, cut in half',
      'medium onion, quartered',
      'To serve',
      'spicy salsa',
    ])
    expect(out[2].heading).toBe(true)
    expect(out[3].heading).toBeUndefined() // a real measure-less ingredient survives
  })

  it('never folds into a heading, and keeps an orphan qualifier rather than losing it', () => {
    const out = foldIngredientRows([
      { quantity: '', unit: '', item: 'To serve' },
      { quantity: '', unit: '', item: 'chopped' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0].heading).toBe(true)
    expect(out[1].item).toBe('chopped')
  })

  it('a row with a measure is always an ingredient, whatever it is called', () => {
    const out = foldIngredientRows([{ quantity: '2', unit: 'tbsp', item: 'chopped' }])
    expect(out).toHaveLength(1)
    expect(out[0].item).toBe('chopped')
  })

  it('attaches a parenthetical without a comma', () => {
    const out = foldIngredientRows([
      { quantity: '1', unit: '', item: 'large ancho chilli' },
      { quantity: '', unit: '', item: '(available online), stem and seeds removed' },
    ])
    expect(out[0].item).toBe('large ancho chilli (available online), stem and seeds removed')
  })
})
