import { describe, expect, it } from 'vitest'
import { consolidateShoppingList, weeklyCost, type Pantry } from '@/lib/mealPlan'

const pantry = (ids: number[] = [], names: string[] = []): Pantry => ({
  ids: new Set(ids),
  names: new Set(names.map((n) => n.toLowerCase())),
})

describe('consolidateShoppingList', () => {
  it('nets the same canonical ingredient across recipes, summing per unit', () => {
    const lines = consolidateShoppingList([
      { title: 'Shakshuka', ingredients: [{ quantity: '2', unit: 'clove', item: 'garlic', canonicalId: 11, canonicalName: 'garlic' }] },
      { title: 'Chana', ingredients: [{ quantity: '3', unit: 'clove', item: 'minced garlic', canonicalId: 11, canonicalName: 'garlic' }] },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].name).toBe('garlic')
    expect(lines[0].amounts).toEqual(['5 clove'])
    expect(lines[0].recipes.sort()).toEqual(['Chana', 'Shakshuka'])
  })

  it('keeps mismatched units as separate amounts', () => {
    const lines = consolidateShoppingList([
      { title: 'A', ingredients: [{ quantity: '2', unit: 'tbsp', item: 'oil', canonicalId: 9, canonicalName: 'olive oil' }] },
      { title: 'B', ingredients: [{ quantity: '50', unit: 'g', item: 'oil', canonicalId: 9, canonicalName: 'olive oil' }] },
    ])
    expect(lines[0].amounts.sort()).toEqual(['2 tbsp', '50 g'])
  })

  it('drops pantry items (by id or by name) — staples never re-listed', () => {
    const lines = consolidateShoppingList(
      [
        {
          title: 'A',
          ingredients: [
            { quantity: '1', unit: 'tsp', item: 'salt', canonicalId: 16, canonicalName: 'salt' },
            { quantity: '1', unit: '', item: 'onion', canonicalId: 2, canonicalName: 'onion' },
          ],
        },
      ],
      pantry([16], ['onion']),
    )
    expect(lines).toEqual([]) // salt excluded by id, onion by name
  })

  it('groups uncanonicalized items by name and lists no-quantity items with empty amounts', () => {
    const lines = consolidateShoppingList([
      { title: 'A', ingredients: [{ item: 'fresh thyme' }] },
      { title: 'B', ingredients: [{ item: 'Fresh Thyme' }] }, // same name, different case → one line
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].amounts).toEqual([])
    expect(lines[0].recipes.sort()).toEqual(['A', 'B'])
  })
})

describe('weeklyCost', () => {
  it('sums costPerServing × servings where known and reports coverage', () => {
    const c = weeklyCost([
      { costPerServing: 150, servings: 4 },
      { costPerServing: 120, servings: 2 },
      { costPerServing: null, servings: 4 }, // unknown — excluded, still counts toward total
    ])
    expect(c).toEqual({ totalCents: 150 * 4 + 120 * 2, covered: 2, total: 3 })
  })
})
