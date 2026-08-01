import { describe, expect, it } from 'vitest'

import { pickCreative } from '@/lib/brandCards/creative'

const img = (n: string) => ({ image: n, active: true })

describe('pickCreative', () => {
  it("falls back to the card's own image when there are no creatives", () => {
    // A card created before creatives existed still has to render.
    expect(pickCreative([], 'v1', 1)).toBeNull()
    expect(pickCreative(null, 'v1', 1)).toBeNull()
    expect(pickCreative(undefined, 'v1', 1)).toBeNull()
  })

  it('is stable for a visitor — the image does not flip between page loads', () => {
    const set = [img('a'), img('b'), img('c')]
    const first = pickCreative(set, 'visitor-7', 42)
    for (let i = 0; i < 20; i++) {
      expect(pickCreative(set, 'visitor-7', 42)).toEqual(first)
    }
  })

  it('spreads different visitors across the set', () => {
    const set = [img('a'), img('b'), img('c')]
    const seen = new Set<unknown>()
    for (let i = 0; i < 200; i++) seen.add(pickCreative(set, `visitor-${i}`, 1)?.image)
    expect(seen.size).toBe(3)
  })

  it('does not show every brand its first creative to the same reader', () => {
    // Without salting by card id, one visitor lands on slot 0 of every campaign
    // at once — so a page with several cards shows every brand's opening image
    // to the same person, every time.
    const set = [img('a'), img('b'), img('c'), img('d')]
    const indexes = new Set([1, 2, 3, 4, 5, 6].map((card) => pickCreative(set, 'same-visitor', card)?.index))
    expect(indexes.size).toBeGreaterThan(1)
  })

  it('skips a retired creative instead of leaving a hole', () => {
    // Counting a switched-off image would make its slot render nothing at all.
    const set = [{ image: 'a', active: false }, img('b'), img('c')]
    const images = new Set<unknown>()
    for (let i = 0; i < 200; i++) images.add(pickCreative(set, `v${i}`, 1)?.image)
    expect(images.has('a')).toBe(false)
    expect(images).toEqual(new Set(['b', 'c']))
  })

  it('ignores a creative with no image at all', () => {
    expect(pickCreative([{ image: null, active: true }], 'v1', 1)).toBeNull()
  })

  it('carries a per-image line, and falls back when it is blank', () => {
    expect(pickCreative([{ image: 'a', tagline: '  Cold-pressed  ' }], 'v', 1)?.tagline).toBe('Cold-pressed')
    expect(pickCreative([{ image: 'a', tagline: '   ' }], 'v', 1)?.tagline).toBeNull()
    expect(pickCreative([{ image: 'a' }], 'v', 1)?.tagline).toBeNull()
  })
})
