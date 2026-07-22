// tests/unit/ingredients/match.spec.ts
import { describe, expect, it } from 'vitest'
import { matchIngredient, type Candidate } from '@/lib/ingredients/match'

const candidates: Candidate[] = [
  { id: 1, name: 'olive oil', aliases: ['extra-virgin olive oil', 'evoo'] },
  { id: 2, name: 'garlic', aliases: [] },
  { id: 3, name: 'sour cream', aliases: [] },
]

describe('matchIngredient', () => {
  it('matches canonical name exactly', () => {
    expect(matchIngredient('garlic', candidates)).toEqual({ id: 2, confidence: 'exact' })
  })
  it('matches an alias exactly', () => {
    expect(matchIngredient('evoo', candidates)).toEqual({ id: 1, confidence: 'exact' })
  })
  it('fuzzy-matches a close variant', () => {
    expect(matchIngredient('olive oils', candidates)).toEqual({ id: 1, confidence: 'fuzzy' })
  })
  it('does NOT collapse distinct ingredients', () => {
    // "cream" must not fuzzy-merge into "sour cream"
    expect(matchIngredient('cream', candidates)).toBeNull()
  })
  it('returns null when nothing is close', () => {
    expect(matchIngredient('saffron', candidates)).toBeNull()
  })
})
