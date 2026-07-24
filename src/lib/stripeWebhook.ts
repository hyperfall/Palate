import type Stripe from 'stripe'

/**
 * Pure mapping from Stripe subscription objects to our `subscriptions` row.
 * Kept free of I/O so the webhook's translation logic is unit-testable.
 *
 * Note: newer Stripe API versions moved `current_period_end` onto the
 * subscription item; older payloads carry it top-level. Read both.
 */

export type SubscriptionUpsert = {
  user_id?: string
  stripe_customer_id: string | null
  stripe_subscription_id: string
  status: string
  price_id: string | null
  current_period_end: string | null
  updated_at: string
}

export function rowFromSubscription(sub: Stripe.Subscription, userId?: string | null): SubscriptionUpsert {
  const item = sub.items?.data?.[0]
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end
  const endUnix = item?.current_period_end ?? legacyEnd ?? null

  return {
    ...(userId ? { user_id: userId } : {}),
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null),
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: item?.price?.id ?? null,
    current_period_end: endUnix ? new Date(endUnix * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }
}
