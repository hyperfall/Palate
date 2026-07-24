import { describe, expect, it } from 'vitest'

import { buildDishShoppingList, buildWeekSnapshot, type Pantry, type WeekSnapshot } from '@/lib/mealPlan'

const pantry = (ids: number[] = [], names: string[] = []): Pantry => ({
  ids: new Set(ids),
  names: new Set(names.map((n) => n.toLowerCase())),
})

/** A one-dish week built through the real snapshot path. */
const week = (
  entries: Array<{ day: number; meal?: string; slug: string; title: string; ingredients: import('@/lib/mealPlan').PlanIngredient[]; position?: number }>,
): WeekSnapshot =>
  buildWeekSnapshot(
    entries.map((e, i) => ({ image: null, position: e.position ?? i, ...e })),
  )

describe('buildDishShoppingList', () => {
  it('makes one category per distinct dish (deduped by slug) with that dish’s full ingredients', () => {
    const list = buildDishShoppingList(
      week([
        { day: 0, slug: 'butter-chicken', title: 'Butter Chicken', ingredients: [{ quantity: '2', unit: 'clove', item: 'garlic', canonicalId: 11, canonicalName: 'garlic' }] },
        // same dish planned again on Wed — one category, not two
        { day: 2, slug: 'butter-chicken', title: 'Butter Chicken', ingredients: [{ quantity: '2', unit: 'clove', item: 'garlic', canonicalId: 11, canonicalName: 'garlic' }] },
      ]),
    )
    expect(list.dishes).toHaveLength(1)
    expect(list.dishes[0].slug).toBe('butter-chicken')
    expect(list.dishes[0].lines.map((l) => l.name)).toEqual(['garlic'])
    expect(list.dishes[0].lines[0].amounts).toEqual(['2 clove'])
  })

  it('nets the buy-list across dish instances (a dish planned twice counts twice)', () => {
    const list = buildDishShoppingList(
      week([
        { day: 0, slug: 'bc', title: 'BC', ingredients: [{ quantity: '2', unit: 'clove', item: 'garlic', canonicalId: 11, canonicalName: 'garlic' }] },
        { day: 2, slug: 'bc', title: 'BC', ingredients: [{ quantity: '2', unit: 'clove', item: 'garlic', canonicalId: 11, canonicalName: 'garlic' }] },
        { day: 1, slug: 'chana', title: 'Chana', ingredients: [{ quantity: '3', unit: 'clove', item: 'garlic', canonicalId: 11, canonicalName: 'garlic' }] },
      ]),
    )
    expect(list.netted).toHaveLength(1)
    expect(list.netted[0].name).toBe('garlic')
    expect(list.netted[0].amounts).toEqual(['7 clove']) // 2 + 2 + 3
  })

  it('per-dish shows full ingredients; the netted buy-list is pantry-aware', () => {
    const list = buildDishShoppingList(
      week([
        {
          day: 0,
          slug: 'a',
          title: 'A',
          ingredients: [
            { quantity: '1', unit: 'tsp', item: 'salt', canonicalId: 16, canonicalName: 'salt' },
            { quantity: '1', unit: '', item: 'chicken', canonicalId: 3, canonicalName: 'chicken' },
          ],
        },
      ]),
      pantry([16]), // salt is a staple
    )
    // the dish category still lists salt (you cook with it)
    expect(list.dishes[0].lines.map((l) => l.name).sort()).toEqual(['chicken', 'salt'])
    // the buy-list drops the staple
    expect(list.netted.map((l) => l.name)).toEqual(['chicken'])
  })

  it('empty week → empty groups', () => {
    expect(buildDishShoppingList(buildWeekSnapshot([]))).toEqual({ dishes: [], netted: [] })
  })

  it('tolerates back-compat snapshots whose dishes have no ingredients field', () => {
    const raw: WeekSnapshot = {
      title: null,
      weekOf: null,
      days: [{ day: 0, meals: [{ meal: 'dinner', dishes: [{ slug: 'x', title: 'X', image: null } as never] }] }],
    }
    const list = buildDishShoppingList(raw)
    expect(list.dishes).toHaveLength(1)
    expect(list.dishes[0].lines).toEqual([])
    expect(list.netted).toEqual([])
  })
})
