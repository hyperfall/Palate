import { describe, expect, it } from 'vitest'

import { parseRecipeText } from '@/lib/recipeParse'

describe('parseRecipeText', () => {
  it('reads a plain notes-app recipe with no headers', () => {
    const r = parseRecipeText(`Birria Tacos
serves 2, 1 h 15

1 tbsp sunflower oil
1kg braising steak
4 guajillo chillies
2 medium tomatoes, cut in half

Heat the oil in a large pan and brown the steak all over, about 8 minutes.
Toast the chillies for 2 mins, then blend with the tomatoes until smooth.`)

    expect(r.title).toBe('Birria Tacos')
    expect(r.servings).toBe(2)
    expect(r.ingredientRows.map((i) => i.item)).toEqual([
      'sunflower oil',
      'braising steak',
      'guajillo chillies',
      'medium tomatoes, cut in half',
    ])
    expect(r.ingredientRows[1]).toMatchObject({ quantity: '1', unit: 'kg' })
    expect(r.stepRows).toHaveLength(2)
    expect(r.stepRows[0]).toMatch(/^Heat the oil/)
  })

  it('honours explicit section headers', () => {
    const r = parseRecipeText(`Chana Masala

Ingredients
400g chickpeas
1 onion

Method
Fry the onion.
Add the chickpeas and simmer.`)
    expect(r.ingredientRows).toHaveLength(2)
    expect(r.stepRows).toEqual(['Fry the onion.', 'Add the chickpeas and simmer.'])
  })

  it('strips numbered and bulleted markers', () => {
    const r = parseRecipeText(`Soup
Ingredients
- 2 carrots
* 1 onion
Method
1. Chop everything.
2) Simmer for 20 minutes.`)
    expect(r.ingredientRows.map((i) => i.item)).toEqual(['carrots', 'onion'])
    expect(r.stepRows).toEqual(['Chop everything.', 'Simmer for 20 minutes.'])
  })

  it('picks up prep and cook times separately', () => {
    const r = parseRecipeText(`Stew
Prep 15 min
Cook 1 hr 30 min
2 onions
Brown the onions slowly until they are deeply golden and sweet.`)
    expect(r.prepMinutes).toBe(15)
    expect(r.cookMinutes).toBe(90)
  })

  it('never rewinds to ingredients once steps have started', () => {
    const r = parseRecipeText(`Pasta
200g spaghetti
Boil the pasta in well salted water until al dente, about nine minutes.
Salt`)
    expect(r.stepRows).toHaveLength(2) // trailing "Salt" stays a step, not a phantom ingredient
    expect(r.ingredientRows).toHaveLength(1)
  })

  it('folds qualifier lines into the ingredient above, as the studio does', () => {
    const r = parseRecipeText(`Ragu
Ingredients
2 medium onions
finely chopped
1 kg beef mince`)
    expect(r.ingredientRows.map((i) => i.item)).toEqual(['medium onions, finely chopped', 'beef mince'])
  })

  it('flags a section label instead of treating it as food', () => {
    const r = parseRecipeText(`Tacos
Ingredients
1 kg beef
To serve
2 limes`)
    const heading = r.ingredientRows.find((i) => i.heading)
    expect(heading?.item).toBe('To serve')
  })

  it('survives empty and junk input', () => {
    expect(parseRecipeText('').stepRows).toEqual([])
    expect(parseRecipeText('   \n  \n').title).toBe('')
  })
})
