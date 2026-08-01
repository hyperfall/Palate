import { describe, expect, it } from 'vitest'

import { isFuture, parsePeriod, periodFor, shiftPeriod, startOfWeek } from '@/lib/ranking'

const at = (iso: string) => new Date(iso)

describe('periodFor', () => {
  it('snaps a day to midnight UTC and ends a day later', () => {
    const p = periodFor('day', at('2026-07-30T18:45:00Z'))
    expect(p.start?.toISOString()).toBe('2026-07-30T00:00:00.000Z')
    expect(p.end?.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(p.slug).toBe('2026-07-30')
    expect(p.label).toBe('30 July 2026')
  })

  it('starts weeks on Monday, including when the anchor is a Sunday', () => {
    // 2026-08-02 is a Sunday; its week began Monday the 27th of July.
    expect(startOfWeek(at('2026-08-02T12:00:00Z')).toISOString()).toBe('2026-07-27T00:00:00.000Z')
    // And a Monday anchor is already the start.
    expect(startOfWeek(at('2026-07-27T00:00:00Z')).toISOString()).toBe('2026-07-27T00:00:00.000Z')
  })

  it('labels a week that spans two months readably', () => {
    const p = periodFor('week', at('2026-07-30T00:00:00Z'))
    expect(p.label).toBe('27 July – 2 August 2026')
    expect(p.slug).toBe('w2026-07-27')
  })

  it('ends February on the 1st of March, leap year included', () => {
    expect(periodFor('month', at('2024-02-15T00:00:00Z')).end?.toISOString()).toBe(
      '2024-03-01T00:00:00.000Z',
    )
  })

  it('rolls December into the next January without a special case', () => {
    const p = periodFor('month', at('2026-12-09T00:00:00Z'))
    expect(p.end?.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(p.slug).toBe('2026-12')
  })

  it('has no bounds for all-time', () => {
    const p = periodFor('all', at('2026-07-30T00:00:00Z'))
    expect(p.start).toBeNull()
    expect(p.end).toBeNull()
  })
})

describe('parsePeriod', () => {
  const now = at('2026-07-30T12:00:00Z')

  it('reads each slug shape back to the right grain', () => {
    expect(parsePeriod('2026-07-30', now)?.grain).toBe('day')
    expect(parsePeriod('w2026-07-27', now)?.grain).toBe('week')
    expect(parsePeriod('2026-07', now)?.grain).toBe('month')
    expect(parsePeriod('2026', now)?.grain).toBe('year')
    expect(parsePeriod('all', now)?.grain).toBe('all')
    expect(parsePeriod(undefined, now)?.grain).toBe('all')
  })

  it('round-trips: every period parses back to itself', () => {
    for (const g of ['day', 'week', 'month', 'year'] as const) {
      const p = periodFor(g, now)
      expect(parsePeriod(p.slug, now)?.slug).toBe(p.slug)
    }
  })

  it('rejects impossible dates rather than rolling them over', () => {
    // JS would happily turn 31 February into 3 March; a URL that means nothing
    // should 404, not silently show a different day.
    expect(parsePeriod('2026-02-31', now)).toBeNull()
    expect(parsePeriod('2026-13', now)).toBeNull()
    expect(parsePeriod('2026-00', now)).toBeNull()
    expect(parsePeriod('nonsense', now)).toBeNull()
    expect(parsePeriod('20260730', now)).toBeNull()
  })
})

describe('shiftPeriod', () => {
  it('steps a month back across a year boundary', () => {
    const jan = periodFor('month', at('2026-01-10T00:00:00Z'))
    expect(shiftPeriod(jan, -1)?.slug).toBe('2025-12')
  })

  it('steps a day forward across a month boundary', () => {
    const last = periodFor('day', at('2026-07-31T00:00:00Z'))
    expect(shiftPeriod(last, 1)?.slug).toBe('2026-08-01')
  })

  it('steps a week by exactly seven days', () => {
    const w = periodFor('week', at('2026-07-30T00:00:00Z'))
    expect(shiftPeriod(w, 1)?.slug).toBe('w2026-08-03')
    expect(shiftPeriod(w, -1)?.slug).toBe('w2026-07-20')
  })

  it('gives all-time no neighbours', () => {
    expect(shiftPeriod(periodFor('all', at('2026-07-30T00:00:00Z')), 1)).toBeNull()
  })
})

describe('isFuture', () => {
  const now = at('2026-07-30T12:00:00Z')

  it('knows tomorrow has no votes yet', () => {
    expect(isFuture(periodFor('day', at('2026-07-31T00:00:00Z')), now)).toBe(true)
  })

  it('counts the current bucket as present, not future', () => {
    expect(isFuture(periodFor('day', now), now)).toBe(false)
    expect(isFuture(periodFor('month', now), now)).toBe(false)
  })
})

describe('parsePeriod — impossible week slugs', () => {
  const now = new Date('2026-08-01T12:00:00Z')

  it('rejects a week slug naming a date that does not exist', () => {
    // Date.UTC never returns NaN for finite numbers — it rolls the value over —
    // so the old Number.isNaN guard here was dead code and w2026-02-31 served
    // the 2 March board under a URL claiming February.
    expect(parsePeriod('w2026-02-31', now)).toBeNull()
    expect(parsePeriod('w2026-04-31', now)).toBeNull()
    expect(parsePeriod('w2025-02-29', now)).toBeNull()
  })

  it('rejects an out-of-range month rather than rolling into another year', () => {
    // w2026-13-10 resolved to a board in January 2027 — a full year from what
    // the URL said.
    expect(parsePeriod('w2026-13-10', now)).toBeNull()
    expect(parsePeriod('w2026-00-10', now)).toBeNull()
  })

  it('still accepts a real week, and a leap day that exists', () => {
    expect(parsePeriod('w2026-07-27', now)?.slug).toBe('w2026-07-27')
    expect(parsePeriod('2024-02-29', now)?.slug).toBe('2024-02-29')
  })
})
