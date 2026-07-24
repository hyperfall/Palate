import { NextResponse, type NextRequest } from 'next/server'

import { getSubscriptionRow } from '@/lib/entitlements'
import { getStripe } from '@/lib/stripe'
import { serverUser } from '@/lib/supabase/server'

/**
 * Opens the Stripe Customer Portal so a supporter can update payment details or
 * cancel. Needs a signed-in user with a saved Stripe customer id (set by the
 * webhook after their first checkout).
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })

  const user = await serverUser()
  if (!user) return NextResponse.redirect(new URL('/account', request.url))

  const row = await getSubscriptionRow()
  if (!row?.stripe_customer_id) return NextResponse.redirect(new URL('/support', request.url))

  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: new URL('/account', request.url).toString(),
  })
  return NextResponse.redirect(session.url, { status: 303 })
}
