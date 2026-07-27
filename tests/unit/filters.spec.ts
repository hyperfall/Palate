import { describe, expect, it } from 'vitest'

import {
  buildWhere,
  catalogHref,
  countActiveFilters,
  encodeTasteRange,
  parseFilters,
  parseTasteRange,
  sortExpression,
  toSearchParams,
} from '@/lib/filters'

describe('parseFilters', () => {
  it('defaults to an unfiltered, newest-first catalog', () => {
    const filters = parseFilters({})
    expect(filters).toEqual({
      cuisines: [],
      courses: [],
      ingredients: [],
      diets: [],
      difficulties: [],
      taste: {},
      maxMinutes: null,
      maxCalories: null,
      minRating: null,
      maxCost: null,
      equipment: [],
      onePan: false,
      makeAhead: false,
      keepsWell: false,
      tasteVector: null,
      q: '',
      page: 1,
      sort: 'newest',
    })
  })

  it('accepts repeated params and comma-separated lists alike', () => {
    expect(parseFilters({ cuisine: ['thai', 'korean'] }).cuisines).toEqual(['thai', 'korean'])
    expect(parseFilters({ cuisine: 'thai,korean' }).cuisines).toEqual(['thai', 'korean'])
  })

  it('drops dietary and difficulty values that are not in the vocabulary', () => {
    const filters = parseFilters({ diet: 'vegan,not-a-diet', difficulty: 'easy,impossible' })
    expect(filters.diets).toEqual(['vegan'])
    expect(filters.difficulties).toEqual(['easy'])
  })

  it('trims and bounds the search query', () => {
    expect(parseFilters({ q: '  tofu  ' }).q).toBe('tofu')
    expect(parseFilters({ q: 'x'.repeat(200) }).q).toHaveLength(80)
  })

  it('parses and floors the page number', () => {
    expect(parseFilters({ page: '3' }).page).toBe(3)
    expect(parseFilters({ page: '0' }).page).toBe(1)
    expect(parseFilters({ page: 'x' }).page).toBe(1)
  })

  it('falls back to the default sort when handed an unknown key', () => {
    expect(parseFilters({ sort: 'drop table' }).sort).toBe('newest')
    expect(parseFilters({ sort: 'quickest' }).sort).toBe('quickest')
  })
})

describe('parseTasteRange', () => {
  it('parses a min-max range', () => {
    expect(parseTasteRange('2-4')).toEqual({ min: 2, max: 4 })
  })

  it('expresses "at least this much" — the request a ceiling never could', () => {
    expect(parseTasteRange('3-5')).toEqual({ min: 3, max: 5 })
  })

  it('treats a bare number as a legacy ceiling so old shared URLs keep working', () => {
    expect(parseTasteRange('2')).toEqual({ min: 0, max: 2 })
  })

  it('keeps zero as a real constraint — "no heat at all" is a genuine request', () => {
    expect(parseTasteRange('0')).toEqual({ min: 0, max: 0 })
    expect(parseTasteRange('0-0')).toEqual({ min: 0, max: 0 })
  })

  it('drops the full scale — "0-5" constrains nothing', () => {
    expect(parseTasteRange('0-5')).toBeNull()
    expect(parseTasteRange('5')).toBeNull()
  })

  it('swaps inverted bounds rather than producing an empty range', () => {
    expect(parseTasteRange('4-1')).toEqual({ min: 1, max: 4 })
  })

  it('clamps out-of-scale values and rejects garbage', () => {
    expect(parseTasteRange('2-9')).toEqual({ min: 2, max: 5 })
    expect(parseTasteRange('hot')).toBeNull()
    expect(parseTasteRange('')).toBeNull()
  })

  it('round-trips through encodeTasteRange', () => {
    expect(parseTasteRange(encodeTasteRange({ min: 1, max: 4 }))).toEqual({ min: 1, max: 4 })
  })
})

describe('buildWhere', () => {
  it('always restricts to published recipes', () => {
    const where = buildWhere(parseFilters({})) as { and: Record<string, unknown>[] }
    expect(where.and).toContainEqual({ status: { equals: 'published' } })
  })

  it('combines multiple dietary tags additively', () => {
    // "vegan + gluten-free" has to mean both. An `in` query would mean either,
    // and would hand a vegan a recipe with butter in it.
    const where = buildWhere(parseFilters({ diet: 'vegan,gluten-free' })) as {
      and: Record<string, unknown>[]
    }
    expect(where.and).toContainEqual({ dietaryTags: { contains: 'vegan' } })
    expect(where.and).toContainEqual({ dietaryTags: { contains: 'gluten-free' } })
  })

  it('translates a taste range into both bounds', () => {
    const where = buildWhere(parseFilters({ spiciness: '2-4' })) as {
      and: Record<string, unknown>[]
    }
    expect(where.and).toContainEqual({ spiciness: { greater_than_equal: 2 } })
    expect(where.and).toContainEqual({ spiciness: { less_than_equal: 4 } })
  })

  it('omits the redundant bound when a range touches the end of the scale', () => {
    const where = buildWhere(parseFilters({ spiciness: '3-5' })) as {
      and: Record<string, unknown>[]
    }
    expect(where.and).toContainEqual({ spiciness: { greater_than_equal: 3 } })
    expect(where.and.some((c) => JSON.stringify(c).includes('less_than_equal'))).toBe(false)
  })

  it('searches titles when q is present', () => {
    const where = buildWhere(parseFilters({ q: 'tofu' })) as { and: Record<string, unknown>[] }
    expect(where.and).toContainEqual({ title: { like: 'tofu' } })
  })

  it('treats multiple cuisines as alternatives', () => {
    const where = buildWhere(parseFilters({ cuisine: 'thai,korean' })) as {
      and: Record<string, unknown>[]
    }
    expect(where.and).toContainEqual({ 'cuisine.slug': { in: ['thai', 'korean'] } })
  })
})

describe('sortExpression', () => {
  it('sorts newest by descending publish date', () => {
    expect(sortExpression('newest')).toEqual(['-publishedAt', '-id'])
  })

  it('sorts quickest by ascending total time', () => {
    expect(sortExpression('quickest')).toEqual(['totalMinutes', '-id'])
  })

  it('sorts a taste axis by most-of-it-first', () => {
    expect(sortExpression('spiciness')).toEqual(['-spiciness', '-id'])
  })

  it('always carries the id tiebreaker (ties break pagination without one)', () => {
    for (const key of ['newest', 'top', 'foryou', 'richness'] as const) {
      expect(sortExpression(key).at(-1)).toBe('-id')
    }
  })

  it('sorts top-rated by descending rating score', () => {
    expect(sortExpression('top')).toEqual(['-ratingScore', '-id'])
  })
})

describe('minRating', () => {
  it('parses an allowed threshold', () => {
    expect(parseFilters({ rating: '4' }).minRating).toBe(4)
    expect(parseFilters({ rating: '4.5' }).minRating).toBe(4.5)
  })

  it('rejects out-of-range or garbage thresholds', () => {
    expect(parseFilters({ rating: '0' }).minRating).toBeNull()
    expect(parseFilters({ rating: '6' }).minRating).toBeNull()
    expect(parseFilters({ rating: 'nope' }).minRating).toBeNull()
    expect(parseFilters({}).minRating).toBeNull()
  })

  it('adds a ratingScore floor to the where clause', () => {
    const where = buildWhere(parseFilters({ rating: '4' })) as { and: Record<string, unknown>[] }
    expect(where.and).toContainEqual({ ratingScore: { greater_than_equal: 4 } })
  })

  it('adds no rating clause when unconstrained', () => {
    const where = buildWhere(parseFilters({})) as { and: Record<string, unknown>[] }
    expect(where.and.some((c) => 'ratingScore' in c)).toBe(false)
  })

  it('survives a URL round-trip', () => {
    const reparsed = parseFilters(
      Object.fromEntries(toSearchParams(parseFilters({ rating: '4.5' })).entries()),
    )
    expect(reparsed.minRating).toBe(4.5)
  })

  it('counts as one active narrowing', () => {
    expect(countActiveFilters(parseFilters({ rating: '4' }))).toBe(1)
  })
})

describe('URL round-trip', () => {
  it('serialises filters back to the same canonical shape', () => {
    const original = parseFilters({
      cuisine: 'korean,indian',
      diet: 'vegan',
      spiciness: '3-5',
      time: '30',
      q: 'curry',
      sort: 'quickest',
      page: '2',
    })
    const reparsed = parseFilters(Object.fromEntries(toSearchParams(original).entries()))
    // Repeated params collapse to strings via fromEntries, so lists with one
    // value survive; multi-value lists are covered by the comma form.
    expect(reparsed.diets).toEqual(['vegan'])
    expect(reparsed.taste).toEqual(original.taste)
    expect(reparsed.maxMinutes).toBe(30)
    expect(reparsed.q).toBe('curry')
    expect(reparsed.sort).toBe('quickest')
    expect(reparsed.page).toBe(2)
  })

  it('produces the bare catalog path when nothing is set', () => {
    expect(catalogHref(parseFilters({}))).toBe('/recipes')
  })

  it('omits defaults from the URL', () => {
    const href = catalogHref(parseFilters({ sort: 'newest', page: '1' }))
    expect(href).toBe('/recipes')
  })
})

describe('countActiveFilters', () => {
  it('counts each narrowing the visitor has applied', () => {
    const filters = parseFilters({ diet: 'vegan', spiciness: '3-5', q: 'tofu', time: '30' })
    expect(countActiveFilters(filters)).toBe(4)
  })

  it('does not count sort or page — they reorder, not narrow', () => {
    expect(countActiveFilters(parseFilters({ sort: 'quickest', page: '3' }))).toBe(0)
  })
})
