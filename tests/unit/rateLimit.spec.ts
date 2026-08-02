import { describe, expect, it, vi, afterEach } from 'vitest'

import { rateLimit } from '@/lib/rateLimit'

afterEach(() => vi.useRealTimers())

describe('rateLimit', () => {
  it('allows up to the limit, then refuses with a retry hint', () => {
    const key = `t-${Math.random()}`
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60_000).ok).toBe(true)
    const over = rateLimit(key, 5, 60_000)
    expect(over.ok).toBe(false)
    expect(over.retryAfter).toBeGreaterThan(0)
  })

  it('opens a fresh window once the old one expires', () => {
    vi.useFakeTimers()
    const key = `t-${Math.random()}`
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 1_000)
    expect(rateLimit(key, 3, 1_000).ok).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(rateLimit(key, 3, 1_000).ok).toBe(true)
  })

  it('keeps counting correctly for a key that survives a sweep', () => {
    // Eviction runs mid-flight once the map passes its threshold. A key that is
    // still INSIDE its window must not be swept away with the expired ones —
    // that would silently reset someone's allowance and defeat the limit.
    vi.useFakeTimers()
    const live = `live-${Math.random()}`
    rateLimit(live, 2, 60_000)
    // Push the map well past the sweep threshold with short-lived keys.
    for (let i = 0; i < 12_000; i++) rateLimit(`churn-${i}`, 120, 1)
    vi.advanceTimersByTime(5)
    for (let i = 0; i < 12_000; i++) rateLimit(`churn2-${i}`, 120, 1)
    // The long-window key kept its count: one more allowed, then refused.
    expect(rateLimit(live, 2, 60_000).ok).toBe(true)
    expect(rateLimit(live, 2, 60_000).ok).toBe(false)
  })
})
