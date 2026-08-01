import { describe, expect, it } from 'vitest'

import {
  buildRotationSchedule,
  selectBrandCards,
  type BrandCardInput,
  type RecipeContext,
} from '@/lib/brandCards/select'

const RECIPE: RecipeContext = { id: 'r1', cuisineId: 'c1', brandSlotIds: [] }
const NOW = new Date('2026-07-18T12:00:00Z')

function card(overrides: Partial<BrandCardInput> & { id: string }): BrandCardInput {
  return {
    brand: `Brand ${overrides.id}`,
    weight: 1,
    active: true,
    startsAt: null,
    endsAt: null,
    targetRegions: [],
    assignedCuisines: ['c1'],
    assignedRecipes: [],
    ...overrides,
  }
}

function select(cards: BrandCardInput[], opts: Partial<Parameters<typeof selectBrandCards>[0]> = {}) {
  return selectBrandCards({
    cards,
    recipe: RECIPE,
    region: 'GB',
    rotation: { visitorKey: 'visitor-a', cursor: 0 },
    now: NOW,
    limit: 1,
    ...opts,
  })
}

describe('selectBrandCards — eligibility (spec §6 step 1)', () => {
  it('includes a card assigned to the recipe’s cuisine', () => {
    const result = select([card({ id: 'a', assignedCuisines: ['c1'] })])
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('includes a card assigned to the recipe directly', () => {
    const result = select([card({ id: 'a', assignedCuisines: [], assignedRecipes: ['r1'] })])
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('includes a card the recipe opted into via brandSlots', () => {
    const result = select([card({ id: 'a', assignedCuisines: [], assignedRecipes: [] })], {
      recipe: { ...RECIPE, brandSlotIds: ['a'] },
    })
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('excludes a card targeting neither this recipe nor its cuisine', () => {
    const result = select([card({ id: 'a', assignedCuisines: ['other'], assignedRecipes: ['other'] })])
    expect(result).toEqual([])
  })

  it('excludes an untargeted card rather than treating it as global', () => {
    // An empty targeting set is an unfinished card, not a wildcard. Defaulting
    // it to "show everywhere" would leak drafts onto every recipe on the site.
    const result = select([card({ id: 'a', assignedCuisines: [], assignedRecipes: [] })])
    expect(result).toEqual([])
  })

  it('excludes inactive cards', () => {
    const result = select([card({ id: 'a', active: false })])
    expect(result).toEqual([])
  })

  it('excludes zero-weight cards', () => {
    const result = select([card({ id: 'a', weight: 0 })])
    expect(result).toEqual([])
  })
})

describe('selectBrandCards — flight dates (spec §6 step 1)', () => {
  it('excludes a card whose flight has not started', () => {
    const result = select([card({ id: 'a', startsAt: '2026-08-01T00:00:00Z' })])
    expect(result).toEqual([])
  })

  it('excludes a card whose flight has ended', () => {
    const result = select([card({ id: 'a', endsAt: '2026-07-01T00:00:00Z' })])
    expect(result).toEqual([])
  })

  it('includes a card inside its flight window', () => {
    const result = select([
      card({ id: 'a', startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-08-01T00:00:00Z' }),
    ])
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('treats missing dates as an open-ended flight', () => {
    const result = select([card({ id: 'a', startsAt: null, endsAt: null })])
    expect(result.map((c) => c.id)).toEqual(['a'])
  })
})

describe('selectBrandCards — region targeting (spec §6 step 2)', () => {
  it('treats an empty targetRegions as global', () => {
    const result = select([card({ id: 'a', targetRegions: [] })], { region: 'JP' })
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('includes a card whose regions contain the visitor region', () => {
    const result = select([card({ id: 'a', targetRegions: [{ code: 'GB' }, { code: 'IE' }] })], {
      region: 'GB',
    })
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('excludes a card targeting other regions', () => {
    const result = select([card({ id: 'a', targetRegions: [{ code: 'US' }] })], { region: 'GB' })
    expect(result).toEqual([])
  })

  it('matches region codes case-insensitively', () => {
    const result = select([card({ id: 'a', targetRegions: [{ code: 'gb' }] })], { region: 'Gb' })
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('falls back to global-only cards when the visitor region is unknown', () => {
    // Vercel geo headers are absent on localhost and for some proxied traffic.
    // A region-targeted card must not be shown to an unplaceable visitor.
    const result = select(
      [card({ id: 'global', targetRegions: [] }), card({ id: 'gb-only', targetRegions: [{ code: 'GB' }] })],
      { region: null, limit: 5 },
    )
    expect(result.map((c) => c.id)).toEqual(['global'])
  })
})

describe('buildRotationSchedule — weighted round-robin (spec §6 step 3)', () => {
  it('gives each card a number of slots equal to its weight', () => {
    const schedule = buildRotationSchedule([
      card({ id: 'a', weight: 3 }),
      card({ id: 'b', weight: 1 }),
    ])
    expect(schedule).toHaveLength(4)
    expect(schedule.filter((id) => id === 'a')).toHaveLength(3)
    expect(schedule.filter((id) => id === 'b')).toHaveLength(1)
  })

  it('interleaves rather than blocking, so a heavy card does not run consecutively', () => {
    // "rotate cleanly ... not just random, which clumps" — a weight-3 card must
    // not produce aaab; it must spread across the cycle.
    const schedule = buildRotationSchedule([
      card({ id: 'a', weight: 3 }),
      card({ id: 'b', weight: 3 }),
    ])
    expect(schedule).toEqual(['a', 'b', 'a', 'b', 'a', 'b'])
  })

  it('is deterministic regardless of input ordering', () => {
    const one = buildRotationSchedule([card({ id: 'a', weight: 2 }), card({ id: 'b', weight: 1 })])
    const two = buildRotationSchedule([card({ id: 'b', weight: 1 }), card({ id: 'a', weight: 2 })])
    expect(one).toEqual(two)
  })
})

describe('selectBrandCards — rotation behaviour (spec §6 step 3)', () => {
  const pool = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })]

  it('is deterministic for the same visitor and cursor', () => {
    const a = select(pool, { rotation: { visitorKey: 'v1', cursor: 0 } })
    const b = select(pool, { rotation: { visitorKey: 'v1', cursor: 0 } })
    expect(a).toEqual(b)
  })

  it('advances through the pool as the visitor’s cursor increments', () => {
    const seen = [0, 1, 2].map(
      (cursor) => select(pool, { rotation: { visitorKey: 'v1', cursor } })[0]?.id,
    )
    expect(new Set(seen).size).toBe(3)
  })

  it('spreads the first impression across visitors instead of always starting at the same card', () => {
    const firsts = new Set(
      Array.from({ length: 60 }, (_, i) =>
        select(pool, { rotation: { visitorKey: `visitor-${i}`, cursor: 0 } })[0]?.id,
      ),
    )
    expect(firsts.size).toBeGreaterThan(1)
  })

  it('honours weight across a full cycle of a single visitor', () => {
    const weighted = [card({ id: 'heavy', weight: 3 }), card({ id: 'light', weight: 1 })]
    const picks = Array.from(
      { length: 4 },
      (_, cursor) => select(weighted, { rotation: { visitorKey: 'v1', cursor } })[0]?.id,
    )
    expect(picks.filter((id) => id === 'heavy')).toHaveLength(3)
    expect(picks.filter((id) => id === 'light')).toHaveLength(1)
  })

  it('splits first impressions across the visitor population in proportion to weight', () => {
    // The commercial promise of §6 is "each brand gets fair recognition". Within
    // one visitor that is round-robin; across the audience it has to hold too,
    // otherwise a brand's real-world exposure depends on who happens to land.
    const weighted = [card({ id: 'heavy', weight: 3 }), card({ id: 'light', weight: 1 })]
    const firsts = Array.from(
      { length: 4000 },
      (_, i) => select(weighted, { rotation: { visitorKey: `visitor-${i}`, cursor: 0 } })[0]?.id,
    )
    const heavyShare = firsts.filter((id) => id === 'heavy').length / firsts.length
    expect(heavyShare).toBeGreaterThan(0.7)
    expect(heavyShare).toBeLessThan(0.8)
  })

  it('returns no more than the requested limit and never repeats a card', () => {
    const result = select(pool, { limit: 2 })
    expect(result).toHaveLength(2)
    expect(new Set(result.map((c) => c.id)).size).toBe(2)
  })

  it('returns every eligible card when the limit exceeds the pool', () => {
    const result = select(pool, { limit: 10 })
    expect(result).toHaveLength(3)
  })

  it('returns an empty array when nothing is eligible', () => {
    expect(select([])).toEqual([])
  })

  it('treats a missing cursor as the start of the visitor’s rotation', () => {
    const withoutCursor = select(pool, { rotation: { visitorKey: 'v1' } })
    const withZero = select(pool, { rotation: { visitorKey: 'v1', cursor: 0 } })
    expect(withoutCursor).toEqual(withZero)
  })
})

describe('selectBrandCards — delivery cap', () => {
  // Assigned to the fixture recipe's cuisine, so the ONLY thing under test is
  // the cap. An unassigned card is ineligible whatever its budget says.
  const capped = (over: Partial<BrandCardInput>): BrandCardInput[] => [
    {
      id: 'a',
      brand: 'Maldon',
      weight: 1,
      active: true,
      assignedCuisines: ['c1'],
      assignedRecipes: [],
      ...over,
    },
  ]

  it('serves while the buy has room', () => {
    expect(select(capped({ maxImpressions: 1000, impressionsServed: 999 }))).toHaveLength(1)
  })

  it('stops the moment the buy is spent', () => {
    // The point of a cap: a fixed buy ends itself rather than depending on
    // someone remembering to switch it off.
    expect(select(capped({ maxImpressions: 1000, impressionsServed: 1000 }))).toHaveLength(0)
    expect(select(capped({ maxImpressions: 1000, impressionsServed: 4000 }))).toHaveLength(0)
  })

  it('treats a cap of zero as zero, not as unlimited', () => {
    // A falsy check here would quietly restart a paused campaign.
    expect(select(capped({ maxImpressions: 0, impressionsServed: 0 }))).toHaveLength(0)
  })

  it('leaves an uncapped card uncapped', () => {
    expect(select(capped({ impressionsServed: 5_000_000 }))).toHaveLength(1)
    expect(select(capped({ maxImpressions: null, impressionsServed: 999 }))).toHaveLength(1)
  })
})
