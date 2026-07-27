import { describe, expect, it } from 'vitest'
import { parseRecipeText } from '@/lib/recipeParse'

describe('quick mode end to end', () => {
  it('turns a WhatsApp-style paste into a fillable recipe', () => {
    const p = parseRecipeText(`Green curry
serves 4
prep 15 min
cook 25 min

2 tbsp green curry paste
400ml coconut milk
1 thai aubergine, quartered
handful thai basil

Fry the paste for a minute until it smells amazing.
Pour in the coconut milk and simmer for 10 minutes.
Add the aubergine and cook until tender.`)
    expect(p.title).toBe('Green curry')
    expect({ s: p.servings, prep: p.prepMinutes, cook: p.cookMinutes }).toEqual({ s: 4, prep: 15, cook: 25 })
    expect(p.ingredientRows).toHaveLength(4)
    expect(p.ingredientRows[0]).toMatchObject({ quantity: '2', unit: 'tbsp', item: 'green curry paste' })
    expect(p.ingredientRows[2].item).toBe('thai aubergine, quartered')
    expect(p.stepRows).toHaveLength(3)
  })
})
