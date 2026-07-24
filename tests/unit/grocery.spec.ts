import { describe, expect, it } from 'vitest'

import { retailersForCountry, searchUrl, shoppingListText, type GroceryRetailerLike } from '@/lib/grocery'

const r = (over: Partial<GroceryRetailerLike> = {}): GroceryRetailerLike => ({
  id: 1,
  label: 'Tesco',
  slug: 'tesco',
  countries: [{ code: 'GB' }],
  searchUrlTemplate: 'https://www.tesco.com/groceries/en-GB/search?query={query}',
  affiliateUrlTemplate: null,
  priority: 0,
  active: true,
  ...over,
})

describe('retailersForCountry', () => {
  it('matches by ISO code, case-insensitively', () => {
    const list = [r(), r({ id: 2, slug: 'walmart', label: 'Walmart', countries: [{ code: 'US' }] })]
    expect(retailersForCountry(list, 'gb').map((x) => x.slug)).toEqual(['tesco'])
    expect(retailersForCountry(list, 'US').map((x) => x.slug)).toEqual(['walmart'])
  })

  it('empty countries means global; inactive is excluded', () => {
    const list = [
      r({ id: 2, slug: 'amazon', label: 'Amazon', countries: [] }),
      r({ id: 3, slug: 'off', active: false }),
    ]
    expect(retailersForCountry(list, 'FR').map((x) => x.slug)).toEqual(['amazon'])
  })

  it('sorts by priority desc, then label', () => {
    const list = [
      r({ id: 1, slug: 'b-shop', label: 'B Shop', priority: 1 }),
      r({ id: 2, slug: 'a-shop', label: 'A Shop', priority: 1 }),
      r({ id: 3, slug: 'top', label: 'Top', priority: 9 }),
    ]
    expect(retailersForCountry(list, 'GB').map((x) => x.slug)).toEqual(['top', 'a-shop', 'b-shop'])
  })

  it('unknown viewer country still gets global retailers only', () => {
    const list = [r(), r({ id: 2, slug: 'global', countries: null })]
    expect(retailersForCountry(list, null).map((x) => x.slug)).toEqual(['global'])
  })
})

describe('searchUrl', () => {
  it('substitutes and URL-encodes the query', () => {
    expect(searchUrl(r(), 'chicken thigh')).toBe(
      'https://www.tesco.com/groceries/en-GB/search?query=chicken%20thigh',
    )
  })

  it('wraps in the affiliate template when present', () => {
    const ret = r({
      affiliateUrlTemplate: 'https://www.awin1.com/cread.php?awinmid=1&ued={url}',
    })
    expect(searchUrl(ret, 'soy sauce')).toBe(
      'https://www.awin1.com/cread.php?awinmid=1&ued=' +
        encodeURIComponent('https://www.tesco.com/groceries/en-GB/search?query=soy%20sauce'),
    )
  })

  it('trims the query', () => {
    expect(searchUrl(r(), '  garlic  ')).toContain('query=garlic')
  })
})

describe('shoppingListText', () => {
  it('renders one line per item with amounts', () => {
    expect(
      shoppingListText([
        { name: 'garlic', amounts: ['2'] },
        { name: 'soy sauce', amounts: ['2 tbsp', '1 tsp'] },
        { name: 'lime wedge', amounts: [] },
      ]),
    ).toBe('garlic — 2\nsoy sauce — 2 tbsp + 1 tsp\nlime wedge')
  })
})
