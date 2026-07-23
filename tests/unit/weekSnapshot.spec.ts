import { describe, expect, it } from 'vitest'

import { buildWeekSnapshot, weekDishCount } from '@/lib/mealPlan'

describe('buildWeekSnapshot', () => {
  it('groups entries into a fixed 7-day week, ordered by position', () => {
    const w = buildWeekSnapshot(
      [
        { day: 2, slug: 'b', title: 'B', image: null, position: 1 },
        { day: 0, slug: 'a', title: 'A', image: 'x.jpg', position: 0 },
        { day: 2, slug: 'c', title: 'C', image: null, position: 0 },
      ],
      { title: 'Wk', weekOf: 'July' },
    )
    expect(w.days).toHaveLength(7)
    expect(w.days[0].dishes.map((d) => d.slug)).toEqual(['a'])
    expect(w.days[2].dishes.map((d) => d.slug)).toEqual(['c', 'b']) // by position
    expect(w.days[1].dishes).toEqual([])
    expect(w.title).toBe('Wk')
    expect(w.weekOf).toBe('July')
    expect(weekDishCount(w)).toBe(3)
  })

  it('drops out-of-range days and defaults meta to null', () => {
    const w = buildWeekSnapshot([{ day: 9, slug: 'x', title: 'X', image: null, position: 0 }])
    expect(weekDishCount(w)).toBe(0)
    expect(w.title).toBeNull()
    expect(w.weekOf).toBeNull()
  })
})
