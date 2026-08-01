import { describe, expect, it } from 'vitest'

import { deliveryFigures } from '@/lib/brandCards/delivery'
import { liveCreatives, pickCreative } from '@/lib/brandCards/creative'

describe('deliveryFigures', () => {
  const base = { impressions: 0, clicks: 0, served: 0 }

  it('reports a click rate to two places', () => {
    expect(deliveryFigures({ ...base, impressions: 1000, clicks: 23 }).ctr).toBe('2.30%')
  })

  it('reports no rate at all rather than dividing by zero', () => {
    // A card can carry a click with no counted impression — an old row, a lost
    // write. Infinity% would read as a broken ad system rather than a gap.
    expect(deliveryFigures({ ...base, impressions: 0, clicks: 4 }).ctr).toBeNull()
    expect(deliveryFigures({ ...base, impressions: 0, clicks: 0 }).ctr).toBeNull()
  })

  it('leaves an uncapped campaign with no progress bar to draw', () => {
    expect(deliveryFigures({ ...base, served: 900 }).percentServed).toBeNull()
    expect(deliveryFigures({ ...base, served: 900, cap: null }).percentServed).toBeNull()
    expect(deliveryFigures({ ...base, served: 900, cap: null }).spent).toBe(false)
  })

  it('never draws a bar past full', () => {
    // Impressions race: several slots can log against the same card before the
    // counter catches up, so served CAN exceed the cap.
    expect(deliveryFigures({ ...base, served: 1500, cap: 1000 }).percentServed).toBe(100)
    expect(deliveryFigures({ ...base, served: 1500, cap: 1000 }).spent).toBe(true)
  })

  it('calls the buy spent exactly when the selector stops serving it', () => {
    // Must agree with isWithinBudget, or the panel says "still running" about a
    // campaign that has already gone dark.
    expect(deliveryFigures({ ...base, served: 999, cap: 1000 }).spent).toBe(false)
    expect(deliveryFigures({ ...base, served: 1000, cap: 1000 }).spent).toBe(true)
  })

  it('treats a cap of zero as a paused campaign, not an uncapped one', () => {
    expect(deliveryFigures({ ...base, served: 0, cap: 0 }).spent).toBe(true)
    expect(deliveryFigures({ ...base, served: 0, cap: 0 }).percentServed).toBeNull()
  })
})

describe('liveCreatives', () => {
  it('is the same set the runtime will actually serve', () => {
    // The admin preview steps through liveCreatives while readers get
    // pickCreative. If those ever disagreed, an editor could approve an image
    // that never ships, or never see one that does.
    const rows = [
      { image: 'a', active: true },
      { image: 'b', active: false },
      { image: null, active: true },
      { image: 'd' },
    ]
    const live = liveCreatives(rows)
    expect(live.map((c) => c.image)).toEqual(['a', 'd'])

    const served = new Set<unknown>()
    for (let i = 0; i < 300; i++) served.add(pickCreative(rows, `v${i}`, 1)?.image)
    expect(served).toEqual(new Set(live.map((c) => c.image)))
  })

  it('is empty when nothing can ship, so the preview falls back like the slot', () => {
    expect(liveCreatives([{ image: 'a', active: false }])).toEqual([])
    expect(liveCreatives(null)).toEqual([])
  })
})
