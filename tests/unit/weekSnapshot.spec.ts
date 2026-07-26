import { describe, expect, it } from 'vitest'

import { buildWeekSnapshot, scaleIngredients, scaleQuantity, weekDishCount } from '@/lib/mealPlan'

describe('buildWeekSnapshot', () => {
  it('groups entries by day → meal → dishes, all ordered', () => {
    const w = buildWeekSnapshot(
      [
        { day: 0, meal: 'dinner', slug: 'd', title: 'D', image: null, position: 1 },
        { day: 0, meal: 'breakfast', slug: 'b', title: 'B', image: 'x.jpg', position: 0 },
        { day: 0, meal: 'dinner', slug: 'd2', title: 'D2', image: null, position: 2 }, // 2nd dinner dish
        { day: 2, slug: 'n', title: 'N', image: null, position: 0 }, // no meal → dinner
      ],
      { title: 'Wk', weekOf: 'July' },
    )
    expect(w.days).toHaveLength(7)
    // meals surface in MEAL_ORDER (breakfast before dinner), only if they have dishes
    expect(w.days[0].meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner'])
    // multiple dishes in one meal, ordered by position
    expect(w.days[0].meals[1].dishes.map((d) => d.slug)).toEqual(['d', 'd2'])
    expect(w.days[1].meals).toEqual([]) // empty day
    expect(w.days[2].meals[0].meal).toBe('dinner') // missing meal defaults to dinner
    expect(w.title).toBe('Wk')
    expect(weekDishCount(w)).toBe(4)
  })

  it('drops out-of-range days', () => {
    const w = buildWeekSnapshot([{ day: 9, meal: 'dinner', slug: 'x', title: 'X', image: null, position: 0 }])
    expect(weekDishCount(w)).toBe(0)
  })
})

describe('scaleQuantity / scaleIngredients', () => {
  it('scales numeric quantities, leaves non-numeric and factor 1 alone', () => {
    expect(scaleQuantity('400', 3)).toBe('1200')
    expect(scaleQuantity('1/2', 2)).toBe('1')
    expect(scaleQuantity('2', 1.5)).toBe('3')
    expect(scaleQuantity('a pinch', 3)).toBe('a pinch')
    expect(scaleQuantity('400', 1)).toBe('400')
    expect(scaleQuantity(null, 2)).toBeNull()
  })

  it('scales an ingredient list by the servings factor', () => {
    const out = scaleIngredients(
      [
        { quantity: '400', unit: 'g', item: 'flour' },
        { quantity: 'a pinch', item: 'salt' },
      ],
      2,
    )
    expect(out[0].quantity).toBe('800')
    expect(out[1].quantity).toBe('a pinch')
  })
})
