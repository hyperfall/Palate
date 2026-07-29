import { describe, expect, it } from 'vitest'

import { parseFilters } from '@/lib/filters'
import { bestRelaxation, relaxations, type Relaxation } from '@/lib/relaxFilters'

const filters = (params: Record<string, string>) => parseFilters(params)

describe('relaxations', () => {
  it('offers one candidate per active constraint', () => {
    const out = relaxations(filters({ cuisine: 'korean', time: '20', diet: 'vegan' }))
    expect(out).toHaveLength(3)
    expect(out.map((r) => r.label).sort()).toEqual([
      'the 20 minute limit',
      'the Korean filter',
      'the Vegan filter',
    ])
  })

  it('each candidate drops exactly one thing and keeps the rest', () => {
    const base = filters({ cuisine: 'korean', time: '20' })
    const dropTime = relaxations(base).find((r) => r.label.includes('minute'))!
    expect(dropTime.filters.maxMinutes).toBeNull()
    expect(dropTime.filters.cuisines).toEqual(['korean'])
  })

  it('humanises slugs rather than showing a URL fragment', () => {
    const out = relaxations(filters({ cuisine: 'south-korean' }))
    expect(out[0].label).toBe('the South Korean filter')
  })

  it('names taste bands by their axis', () => {
    const out = relaxations(filters({ spiciness: '4-5' }))
    expect(out[0].label).toMatch(/band$/)
  })

  it('offers nothing when nothing is filtered', () => {
    expect(relaxations(filters({}))).toEqual([])
  })
})

describe('bestRelaxation', () => {
  const make = (label: string, count: number): Relaxation =>
    ({ label, count, filters: {} as never })

  it('picks the smallest concession that still returns something', () => {
    // Dropping the cuisine returns the whole catalog — technically a result,
    // but it throws away what the reader asked for. Fewest wins.
    const best = bestRelaxation([make('the cuisine filter', 18), make('the 20 minute limit', 3)])
    expect(best?.label).toBe('the 20 minute limit')
  })

  it('ignores candidates that still return nothing', () => {
    const best = bestRelaxation([make('a', 0), make('b', 0), make('c', 5)])
    expect(best?.label).toBe('c')
  })

  it('returns null when no single change helps', () => {
    expect(bestRelaxation([make('a', 0), make('b', 0)])).toBeNull()
    expect(bestRelaxation([])).toBeNull()
  })
})
