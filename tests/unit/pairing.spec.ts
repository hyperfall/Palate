import { describe, expect, it } from 'vitest'

import { tallyPairings, type PairingRecipe } from '@/lib/ingredients/pairing'

const ing = (id: number, name: string) => ({ ingredient: { id, name, slug: name.replace(/ /g, '-') } })

/** Two recipes both built on garlic, plus onion in one of them. */
const recipes: PairingRecipe[] = [
  { ingredients: [ing(1, 'garlic'), ing(2, 'onion'), ing(3, 'chilli')] },
  { ingredients: [ing(1, 'garlic'), ing(3, 'chilli')] },
]

describe('tallyPairings', () => {
  it('counts how many recipes share each other ingredient', () => {
    const pairs = tallyPairings(recipes, 1)
    expect(pairs.map((p) => [p.name, p.count])).toEqual([
      ['chilli', 2],
      ['onion', 1],
    ])
  })

  it('never pairs the subject with itself', () => {
    expect(tallyPairings(recipes, 1).some((p) => p.id === 1)).toBe(false)
  })

  it('counts a recipe once even when it lists the same ingredient twice', () => {
    // "half now, half to finish" is one recipe, not two votes.
    const doubled: PairingRecipe[] = [
      { ingredients: [ing(1, 'garlic'), ing(2, 'onion'), ing(2, 'onion')] },
    ]
    expect(tallyPairings(doubled, 1)).toEqual([
      { id: 2, name: 'onion', slug: 'onion', count: 1 },
    ])
  })

  it('skips rows with no canonical link — a string is not an ingredient', () => {
    const unlinked: PairingRecipe[] = [
      { ingredients: [ing(1, 'garlic'), { ingredient: null }, { ingredient: 42 }] },
    ]
    expect(tallyPairings(unlinked, 1)).toEqual([])
  })

  it('breaks equal counts alphabetically, not by row order', () => {
    const tied: PairingRecipe[] = [{ ingredients: [ing(1, 'garlic'), ing(9, 'zucchini'), ing(8, 'apple')] }]
    expect(tallyPairings(tied, 1).map((p) => p.name)).toEqual(['apple', 'zucchini'])
  })

  it('caps the list', () => {
    const many: PairingRecipe[] = [
      { ingredients: Array.from({ length: 30 }, (_, i) => ing(i + 2, `item-${String(i).padStart(2, '0')}`)) },
    ]
    expect(tallyPairings(many, 1)).toHaveLength(12)
    expect(tallyPairings(many, 1, 3)).toHaveLength(3)
  })

  it('survives recipes with no ingredients at all', () => {
    expect(tallyPairings([{ ingredients: null }, {}], 1)).toEqual([])
  })
})
