import { describe, expect, it } from 'vitest'
import { groupSubstitutions } from '@/lib/substitutions'

describe('groupSubstitutions', () => {
  it('groups by kind in a fixed order and resolves labels', () => {
    const grouped = groupSubstitutions([
      { subText: 'canned tomatoes', kind: 'cupboard', ratio: '1:1' },
      { sub: { name: 'passata' }, kind: 'texture', note: 'thinner' },
      { sub: { name: 'fresh tomatoes' }, kind: 'flavor' },
    ])
    expect(grouped.map((g) => g.kind)).toEqual(['flavor', 'texture', 'cupboard'])
    expect(grouped[0]).toEqual({
      kind: 'flavor',
      title: 'Closest flavour',
      items: [{ label: 'fresh tomatoes' }],
    })
    expect(grouped[2].items[0]).toEqual({ label: 'canned tomatoes', ratio: '1:1' })
  })
  it('drops rows with no usable label and empty groups', () => {
    const grouped = groupSubstitutions([
      { sub: null, subText: '', kind: 'flavor' },
      { subText: 'yogurt', kind: 'cupboard' },
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].kind).toBe('cupboard')
    expect(grouped[0].title).toBe('Probably in your cupboard')
  })
  it('returns [] for empty / null input', () => {
    expect(groupSubstitutions(null)).toEqual([])
    expect(groupSubstitutions([])).toEqual([])
  })
})
