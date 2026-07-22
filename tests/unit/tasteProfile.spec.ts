import { describe, expect, it } from 'vitest'
import { inferProfile, distance, encodeVector, parseVector } from '@/lib/tasteProfile'

const v = (spiciness: number, sweetness: number, richness: number, effort: number) => ({ spiciness, sweetness, richness, effort })

describe('inferProfile', () => {
  it('averages the liked dishes per axis, ignoring dislikes', () => {
    const profile = inferProfile([
      { liked: true, dish: v(4, 0, 4, 2) },
      { liked: true, dish: v(2, 0, 2, 4) },
      { liked: false, dish: v(0, 5, 0, 0) }, // disliked — excluded
    ])
    expect(profile).toEqual(v(3, 0, 3, 3))
  })
  it('returns null when nothing is liked', () => {
    expect(inferProfile([{ liked: false, dish: v(1, 1, 1, 1) }])).toBeNull()
    expect(inferProfile([])).toBeNull()
  })
  it('clamps to the 0–5 integer scale', () => {
    expect(inferProfile([{ liked: true, dish: v(5, 5, 5, 5) }])).toEqual(v(5, 5, 5, 5))
  })
})

describe('distance', () => {
  it('is 0 for identical vectors and grows with difference', () => {
    expect(distance(v(2, 2, 2, 2), v(2, 2, 2, 2))).toBe(0)
    expect(distance(v(0, 0, 0, 0), v(0, 0, 0, 2))).toBe(2)
    expect(distance(v(0, 0, 0, 0), v(1, 0, 0, 0))).toBeLessThan(distance(v(0, 0, 0, 0), v(3, 0, 0, 0)))
  })
})

describe('encode/parse round-trip', () => {
  it('round-trips a vector', () => {
    expect(encodeVector(v(2, 1, 3, 2))).toBe('2-1-3-2')
    expect(parseVector('2-1-3-2')).toEqual(v(2, 1, 3, 2))
  })
  it('rejects malformed or out-of-range input', () => {
    expect(parseVector('')).toBeNull()
    expect(parseVector('1-2-3')).toBeNull()
    expect(parseVector('1-2-3-9')).toBeNull()
    expect(parseVector('a-b-c-d')).toBeNull()
    expect(parseVector(null)).toBeNull()
  })
})
