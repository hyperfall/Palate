import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'

import { rowFromSubscription } from '@/lib/stripeWebhook'

const sub = (over: Record<string, unknown> = {}): Stripe.Subscription =>
  ({
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    items: {
      data: [{ current_period_end: 1_900_000_000, price: { id: 'price_abc' } }],
    },
    ...over,
  }) as unknown as Stripe.Subscription

describe('rowFromSubscription', () => {
  it('maps the item-level period end and price (current API shape)', () => {
    const row = rowFromSubscription(sub(), 'user-1')
    expect(row).toMatchObject({
      user_id: 'user-1',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      status: 'active',
      price_id: 'price_abc',
      current_period_end: new Date(1_900_000_000 * 1000).toISOString(),
    })
  })

  it('falls back to the legacy top-level period end', () => {
    const row = rowFromSubscription(sub({ items: { data: [] }, current_period_end: 1_800_000_000 }))
    expect(row.current_period_end).toBe(new Date(1_800_000_000 * 1000).toISOString())
    expect(row.price_id).toBeNull()
  })

  it('omits user_id when unknown (subscription.* events update by sub id)', () => {
    expect('user_id' in rowFromSubscription(sub())).toBe(false)
  })

  it('carries canceled status through untouched', () => {
    expect(rowFromSubscription(sub({ status: 'canceled' })).status).toBe('canceled')
  })
})

describe('webhook signature verification (constructEvent roundtrip)', () => {
  it('accepts a payload signed with the same secret and rejects a tampered one', () => {
    const stripe = new Stripe('sk_test_offline')
    const secret = 'whsec_test_secret'
    const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } })
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret })

    const event = stripe.webhooks.constructEvent(payload, header, secret)
    expect(event.type).toBe('customer.subscription.updated')

    expect(() => stripe.webhooks.constructEvent(payload + ' ', header, secret)).toThrow()
  })
})
