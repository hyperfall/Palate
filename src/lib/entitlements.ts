import { supabaseServer } from '@/lib/supabase/server'

/**
 * The entitlement model behind the supporter tier. Gates check keys from here,
 * never Stripe or the DB directly — so when "Palate Kitchen" premium content
 * arrives it's a new key in this file, not a rewiring.
 */

export type EntitlementKey = 'supporter'

export type SubscriptionRow = {
  status: string
  current_period_end?: string | null
}

/**
 * Pure derivation: which entitlements a subscription row grants. Active and
 * trialing subscriptions count; an expired `current_period_end` revokes even
 * if a stale status says otherwise (the webhook normally keeps both fresh).
 */
export function entitlementsFor(row: SubscriptionRow | null | undefined): Set<EntitlementKey> {
  const keys = new Set<EntitlementKey>()
  if (!row) return keys

  const statusOk = row.status === 'active' || row.status === 'trialing'
  const end = row.current_period_end ? Date.parse(row.current_period_end) : null
  const periodOk = end === null || Number.isNaN(end) || end > Date.now()

  if (statusOk && periodOk) keys.add('supporter')
  return keys
}

/** Entitlements for the signed-in user (empty set when signed out / unconfigured). */
export async function getEntitlements(): Promise<Set<EntitlementKey>> {
  const supabase = await supabaseServer()
  if (!supabase) return new Set()
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .maybeSingle()
  return entitlementsFor(data)
}

/** The signed-in user's subscription row (for /support status + portal). */
export async function getSubscriptionRow(): Promise<
  (SubscriptionRow & { stripe_customer_id: string | null }) | null
> {
  const supabase = await supabaseServer()
  if (!supabase) return null
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, stripe_customer_id')
    .maybeSingle()
  return data ?? null
}
