import { describe, expect, it } from 'vitest'
import { STAPLES, scoreRecipe, bandRecipes, namesEquivalent } from '@/lib/pantry'

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
  it('covers via a bare-number sub id (unpopulated relationship)', () => {
    const required = [req(5, 'buttermilk', [{ sub: 9, kind: 'cupboard' }])]
    const have = [{ id: 9, name: 'yogurt' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual([])
    expect(s.coveredCount).toBe(1)
  })
})

describe('bandRecipes', () => {
  const scored = (id: string, missing: string[], used: number, required = missing.length + used) => ({
    recipe: id, missing, viaSub: [], requiredCount: required, coveredCount: required - missing.length, usedCount: used,
  })
  it('bands by missing count; shows any recipe you use ≥2 of, no missing cap', () => {
    const b = bandRecipes([
      scored('now', [], 2),
      scored('one', ['feta'], 3),
      scored('three', ['a', 'b', 'c'], 3),
      scored('single-use-nearmiss', ['x'], 1), // uses <2 of yours -> dropped from near-miss
      // uses 3 of yours but is missing 7 (e.g. shakshuka from a 3-item pantry) —
      // shown in "getting there", ranked after closer matches.
      scored('bigger-shop', ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3),
      scored('uses-none', [], 0), // uses none of yours -> dropped entirely
    ])
    expect(b.cookNow.map((r) => r.recipe)).toEqual(['now'])
    expect(b.almost.map((r) => r.recipe)).toEqual(['one'])
    expect(b.gettingThere.map((r) => r.recipe)).toEqual(['three', 'bigger-shop'])
  })
  it('ranks by overlap (uses more of your ingredients) first, then fewest-missing', () => {
    // usedCount: high 6, mid 3, low 2 — overlap dominates even though `mid` is
    // missing fewer items than `high`.
    const b = bandRecipes([
      scored('high', ['a', 'b'], 6, 8),
      scored('mid', ['a'], 3),
      scored('low', ['a', 'b'], 2, 4),
    ])
    expect(b.almost.map((r) => r.recipe)).toEqual(['high', 'mid', 'low'])
  })
  it('breaks equal overlap by fewest-missing', () => {
    const b = bandRecipes([
      scored('far', ['a', 'b', 'c', 'd'], 3), // used 3, missing 4
      scored('near', ['a', 'b', 'c'], 3), // used 3, missing 3
    ])
    expect(b.gettingThere.map((r) => r.recipe)).toEqual(['near', 'far'])
  })
})

describe('accuracy: variants, staples, normalization', () => {
  it('holding the generic covers a colour/size variant, both directions', () => {
    expect(namesEquivalent('onion', 'white onion')).toBe(true)
    expect(namesEquivalent('red bell pepper', 'bell pepper')).toBe(true)
  })

  it('never collapses genuinely different ingredients', () => {
    expect(namesEquivalent('spring onion', 'onion')).toBe(false) // spring ≠ a colour
    expect(namesEquivalent('coconut milk', 'milk')).toBe(false)
    expect(namesEquivalent('red wine vinegar', 'vinegar')).toBe(false)
  })

  it('scores a variant as covered without an id match', () => {
    const s = scoreRecipe(
      'r',
      [{ id: 9, name: 'white onion' }],
      [{ id: 1, name: 'onion' }],
    )
    expect(s.missing).toEqual([])
    expect(s.usedCount).toBe(1)
  })

  it('recognises staples through the normalizer', () => {
    // "sea salt flakes" normalizes to "sea salt flake" — a staple, not a gap.
    const s = scoreRecipe('r', [{ id: 3, name: 'sea salt flakes' }], [{ id: 1, name: 'egg' }])
    expect(s.requiredCount).toBe(0)
  })
})
