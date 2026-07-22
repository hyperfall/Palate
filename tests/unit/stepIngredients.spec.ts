import { describe, expect, it } from 'vitest'
import { buildCookSteps } from '@/lib/stepIngredients'

describe('buildCookSteps', () => {
  it('carries resolved use names onto each step', () => {
    const steps = buildCookSteps([
      { text: 'Fry onion', uses: [{ name: 'onion' }] },
      { text: 'Add garlic', uses: [{ name: 'garlic' }] },
    ])
    expect(steps[0].uses.map((u) => u.name)).toEqual(['onion'])
    expect(steps[1].uses.map((u) => u.name)).toEqual(['garlic'])
  })
  it('flags each ingredient one step before its first use', () => {
    const steps = buildCookSteps([
      { text: 'Fry onion', uses: [{ name: 'onion' }] },
      { text: 'Add garlic and butter', uses: [{ name: 'garlic' }, { name: 'butter' }] },
      { text: 'Add butter again', uses: [{ name: 'butter' }] },
    ])
    // butter+garlic first used in step 2 → surfaced on step 1 (index 0)
    expect(steps[0].prepAhead.sort()).toEqual(['butter', 'garlic'])
    // butter's first use already passed → not repeated on step 2
    expect(steps[1].prepAhead).toEqual([])
    // onion first-used in step 1 has no earlier step to surface on
    expect(steps.every((s) => !s.prepAhead.includes('onion'))).toBe(true)
  })
  it('skips unresolved uses and tolerates missing uses', () => {
    const steps = buildCookSteps([
      { text: 'Do a thing', uses: [42, { name: '' }] },
      { text: 'Another', uses: null },
    ])
    expect(steps[0].uses).toEqual([])
    expect(steps[1].uses).toEqual([])
    expect(steps.every((s) => s.prepAhead.length === 0)).toBe(true)
  })
})
