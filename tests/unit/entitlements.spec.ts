import { describe, expect, it } from 'vitest'

import { entitlementsFor, type SubscriptionRow } from '@/lib/entitlements'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

const row = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  status: 'active',
  current_period_end: future,
  ...over,
})

describe('entitlementsFor', () => {
  it('active + future period end → supporter', () => {
    expect(entitlementsFor(row()).has('supporter')).toBe(true)
  })

  it('trialing counts as supporter', () => {
    expect(entitlementsFor(row({ status: 'trialing' })).has('supporter')).toBe(true)
  })

  it('canceled / past_due / inactive do not', () => {
    for (const status of ['canceled', 'past_due', 'inactive', 'incomplete']) {
      expect(entitlementsFor(row({ status })).size, status).toBe(0)
    }
  })

  it('an expired period end revokes even when status stale-reads active', () => {
    expect(entitlementsFor(row({ current_period_end: past })).size).toBe(0)
  })

  it('a null period end is trusted to the status (webhook keeps it fresh)', () => {
    expect(entitlementsFor(row({ current_period_end: null })).has('supporter')).toBe(true)
  })

  it('no row at all → no entitlements', () => {
    expect(entitlementsFor(null).size).toBe(0)
  })
})
