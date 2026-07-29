import { describe, expect, it } from 'vitest'

import { matchIngredientsInStep } from '@/lib/ingredients/stepMatch'

const BIRRIA = [
  { item: 'sunflower oil', canonicalName: 'sunflower oil' },
  { item: 'braising steak', canonicalName: 'braising steak' },
  { item: 'guajillo chillies', canonicalName: 'guajillo chilli' },
  { item: 'ancho chilli', canonicalName: 'ancho chilli' },
  { item: 'arbol chillies', canonicalName: 'arbol chilli' },
  { item: 'tomatoes', canonicalName: 'tomato' },
  { item: 'white onion', canonicalName: 'onion' },
  { item: 'garlic', canonicalName: 'garlic' },
  { item: 'water', canonicalName: 'water' },
  { item: 'corn tortillas', canonicalName: 'corn tortilla' },
]

describe('matchIngredientsInStep', () => {
  it('finds the ingredients a real step names, including plurals', () => {
    const step =
      'Heat a frying pan over a medium heat and toast the guajillo and ancho chillies for 2 mins. ' +
      'Transfer to a lidded saucepan with the tomatoes and onion. Peel the garlic and add this, too. Add 500ml water.'
    const found = matchIngredientsInStep(step, BIRRIA).map((i) => i.item)
    expect(found).toContain('guajillo chillies')
    expect(found).toContain('ancho chilli')
    expect(found).toContain('tomatoes')
    expect(found).toContain('white onion')
    expect(found).toContain('garlic')
    expect(found).toContain('water')
  })

  it('does not name an ingredient the step never mentions', () => {
    const step = 'Warm the tortillas in a dry pan until pliable.'
    const found = matchIngredientsInStep(step, BIRRIA).map((i) => i.item)
    expect(found).toEqual(['corn tortillas'])
  })

  it('matches on the head noun, not a stray substring', () => {
    // "oil" inside "boiling" must not pull in sunflower oil.
    const step = 'Bring a large pan of boiling water to the stove.'
    const found = matchIngredientsInStep(step, BIRRIA).map((i) => i.item)
    expect(found).not.toContain('sunflower oil')
    expect(found).toContain('water')
  })

  it('keeps the recipe order rather than the order of mention', () => {
    const step = 'Add the garlic, then the tomatoes, then the steak.'
    const found = matchIngredientsInStep(step, BIRRIA).map((i) => i.item)
    expect(found).toEqual(['braising steak', 'tomatoes', 'garlic'])
  })

  it('never returns the same ingredient twice', () => {
    const step = 'Add half the tomatoes now and the rest of the tomatoes later.'
    expect(matchIngredientsInStep(step, BIRRIA)).toHaveLength(1)
  })

  it('skips section headings and empty input', () => {
    expect(matchIngredientsInStep('', BIRRIA)).toEqual([])
    expect(matchIngredientsInStep('Add the garlic.', [{ item: 'To serve', heading: true }])).toEqual([])
  })
})

describe('matchIngredientsInStep — competing head nouns', () => {
  // Birria really does carry two onions: "medium onion" in the cook, and
  // "white onion, finely chopped" under To serve. A step saying "onion" must
  // not send the cook for the garnish.
  const TWO_ONIONS = [
    { item: 'medium onion, quartered', canonicalName: 'onion' },
    { item: 'garlic cloves', canonicalName: 'garlic' },
    { item: 'To serve', heading: true },
    { item: 'white onion, finely chopped', canonicalName: 'white onion' },
  ]

  it('a bare "onion" takes the onion, not the white onion', () => {
    const found = matchIngredientsInStep('Add the tomatoes and onion, then the garlic.', TWO_ONIONS)
    expect(found.map((i) => i.canonicalName)).toEqual(['onion', 'garlic'])
  })

  it('but "white onion" spelled out still takes the white onion', () => {
    const found = matchIngredientsInStep('Scatter with white onion and coriander.', TWO_ONIONS)
    expect(found.map((i) => i.canonicalName)).toEqual(['white onion'])
  })
})

describe('matchIngredientsInStep — false positives found in real recipes', () => {
  const REAL = [
    { item: 'braising steak', canonicalName: 'braising steak' },
    { item: 'medium tomatoes, cut in half', canonicalName: 'tomato' },
    { item: 'arbol chillies (available online; optional)', canonicalName: 'arbol chilli' },
    { item: 'spicy salsa', canonicalName: 'spicy salsa' },
    { item: 'limes, cut into small wedges', canonicalName: 'lime' },
  ]

  it('a stopword inside an ingredient’s prose is not a mention of it', () => {
    // "medium tomatoes, cut in half" must not be summoned by the "in" in this line.
    const step = 'Heat the oil in a large, heavy-based pan and brown the braising steak all over.'
    expect(matchIngredientsInStep(step, REAL).map((i) => i.canonicalName)).toEqual(['braising steak'])
  })

  it('an adjective in the prose is not a mention of an ingredient named after it', () => {
    // "If you want the birria to be spicy" is not a request for spicy salsa.
    const step = 'If you want the birria to be spicy, add the arbol chillies.'
    const found = matchIngredientsInStep(step, REAL).map((i) => i.canonicalName)
    expect(found).toContain('arbol chilli')
    expect(found).not.toContain('spicy salsa')
  })

  it('a preparation word shared with another ingredient is not a mention', () => {
    // Both tomatoes and limes are "cut"; neither is being asked for here.
    const step = 'Pass the blended sauce through a sieve, then cut the meat into chunks.'
    expect(matchIngredientsInStep(step, REAL).map((i) => i.canonicalName)).toEqual([])
  })
})
