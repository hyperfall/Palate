import { describe, expect, it } from 'vitest'
import { STAPLES, scoreRecipe, bandRecipes } from '@/lib/pantry'

const req = (id: number, name: string, substitutions?: any) => ({ id, name, substitutions })

describe('scoreRecipe', () => {
  it('ignores staples and counts covered vs missing', () => {
    const required = [req(1, 'chicken thigh'), req(2, 'spinach'), req(3, 'salt'), req(4, 'feta')]
    const have = [{ id: 1, name: 'chicken thigh' }, { id: 2, name: 'spinach' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual(['feta']) // salt is a staple, dropped
    expect(s.requiredCount).toBe(3) // chicken, spinach, feta (not salt)
    expect(s.coveredCount).toBe(2)
    expect(s.usedCount).toBe(2)
  })
  it('covers a missing ingredient via a substitute you hold, and notes it', () => {
    const required = [
      req(1, 'chicken thigh'),
      req(5, 'buttermilk', [{ sub: { id: 9, name: 'yogurt' }, kind: 'cupboard' }]),
    ]
    const have = [{ id: 1, name: 'chicken thigh' }, { id: 9, name: 'yogurt' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual([])
    expect(s.viaSub).toEqual([{ item: 'buttermilk', sub: 'yogurt' }])
    expect(s.coveredCount).toBe(2)
  })
  it('matches a free-text substitute by name', () => {
    const required = [req(5, 'buttermilk', [{ subText: 'plain yogurt', kind: 'cupboard' }])]
    const have = [{ id: 9, name: 'plain yogurt' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual([])
    expect(s.viaSub[0].sub).toBe('plain yogurt')
  })
})

describe('bandRecipes', () => {
  const scored = (id: string, missing: string[], used: number, required = missing.length + used) => ({
    recipe: id, missing, viaSub: [], requiredCount: required, coveredCount: required - missing.length, usedCount: used,
  })
  it('bands by missing count and drops near-useless matches', () => {
    const b = bandRecipes([
      scored('now', [], 2),
      scored('one', ['feta'], 3),
      scored('three', ['a', 'b', 'c'], 3),
      scored('single-use-nearmiss', ['x'], 1), // uses <2 of yours -> dropped from near-miss
      scored('too-many', ['a', 'b', 'c', 'd', 'e', 'f'], 3), // missing >5 -> dropped
      scored('uses-none', [], 0), // uses none of yours -> dropped entirely
    ])
    expect(b.cookNow.map((r) => r.recipe)).toEqual(['now'])
    expect(b.almost.map((r) => r.recipe)).toEqual(['one'])
    expect(b.gettingThere.map((r) => r.recipe)).toEqual(['three'])
  })
  it('ranks within the full result by missing asc then match ratio desc', () => {
    // m2-high: required 8, covered 6 -> ratio .75 ; m2-low: required 4, covered 2 -> ratio .5
    const b = bandRecipes([
      scored('m2-high', ['a', 'b'], 6, 8),
      scored('m1', ['a'], 3),
      scored('m2-low', ['a', 'b'], 2, 4),
    ])
    expect(b.almost.map((r) => r.recipe)).toEqual(['m1', 'm2-high', 'm2-low'])
  })
})
