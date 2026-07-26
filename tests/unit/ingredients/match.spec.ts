// tests/unit/ingredients/match.spec.ts
import { describe, expect, it } from 'vitest'
import { diceCoefficient, matchIngredient, type Candidate } from '@/lib/ingredients/match'

const candidates: Candidate[] = [
  { id: 1, name: 'olive oil', aliases: ['extra-virgin olive oil', 'evoo'] },
  { id: 2, name: 'garlic', aliases: [] },
  { id: 3, name: 'sour cream', aliases: [] },
  { id: 4, name: 'baking soda', aliases: ['bicarbonate of soda'] },
  { id: 5, name: 'red wine', aliases: [] },
  { id: 6, name: 'greek yoghurt', aliases: [] },
  { id: 7, name: 'tomato', aliases: [] },
  { id: 8, name: 'potato', aliases: [] },
]

describe('diceCoefficient', () => {
  it('is 1 for identical strings and 0 for disjoint', () => {
    expect(diceCoefficient('garlic', 'garlic')).toBe(1)
    expect(diceCoefficient('abc', 'xyz')).toBe(0)
  })
  it('is 0 when either string is shorter than a bigram', () => {
    expect(diceCoefficient('a', 'ab')).toBe(0)
    expect(diceCoefficient('', 'ab')).toBe(0)
  })
  it('is symmetric', () => {
    expect(diceCoefficient('olive oils', 'olive oil')).toBe(diceCoefficient('olive oil', 'olive oils'))
  })
  it('scores a near-identical variant high', () => {
    expect(diceCoefficient('tomatos', 'tomato')).toBeCloseTo(0.909, 2)
  })
})

describe('matchIngredient — exact', () => {
  it('matches the canonical name', () => {
    expect(matchIngredient('garlic', candidates)).toEqual({ id: 2, confidence: 'exact' })
  })
  it('matches an alias', () => {
    expect(matchIngredient('evoo', candidates)).toEqual({ id: 1, confidence: 'exact' })
    expect(matchIngredient('bicarbonate of soda', candidates)).toEqual({ id: 4, confidence: 'exact' })
  })
})

describe('matchIngredient — fuzzy', () => {
  it('matches a close spelling variant of the name', () => {
    expect(matchIngredient('olive oils', candidates)).toEqual({ id: 1, confidence: 'fuzzy' })
    expect(matchIngredient('greek yogurt', candidates)).toEqual({ id: 6, confidence: 'fuzzy' }) // dice ~0.87
  })
  it('picks the highest-scoring candidate, not the first over threshold', () => {
    // "tomatos" scores 0.909 vs tomato and 0.364 vs potato — tomato must win.
    expect(matchIngredient('tomatos', candidates)).toEqual({ id: 7, confidence: 'fuzzy' })
  })
  it('only fuzzy-matches the name, never an alias', () => {
    // "evoot" is close to the alias "evoo" but 0.0 against the name "olive oil":
    // fuzzy is name-only by design, so this stays unmatched (→ review stub).
    expect(matchIngredient('evoot', candidates)).toBeNull()
  })
})

/**
 * The threshold is deliberately conservative: it would rather leave an item as a
 * `needsReview` stub than collapse it into the wrong canonical, because a wrong
 * link silently corrupts nutrition, netting, and substitutions downstream. These
 * cases pin that boundary — if someone lowers FUZZY_THRESHOLD, one of these
 * distinct-but-similar pairs will start mis-linking and fail here first.
 */
describe('matchIngredient — never collapses distinct ingredients', () => {
  it.each([
    ['baking powder', 'baking soda (0.55)'],
    ['red wine vinegar', 'red wine (0.64)'],
    ['cream', 'sour cream (0.62)'],
    ['garlik', 'garlic (0.80, just under threshold)'],
    ['saffron', 'nothing close'],
  ])('leaves %s unmatched (%s)', (input) => {
    expect(matchIngredient(input, candidates)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(matchIngredient('', candidates)).toBeNull()
  })
})
