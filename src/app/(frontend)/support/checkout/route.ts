import { NextResponse, type NextRequest } from 'next/server'

import { getSubscriptionRow } from '@/lib/entitlements'
import { getStripe, supporterPriceId } from '@/lib/stripe'
import { serverUser } from '@/lib/supabase/server'

/**
 * Starts a Stripe Checkout session for the supporter subscription. Requires a
 * signed-in user; passes the Supabase user id as client_reference_id so the
 * webhook can tie the resulting subscription back to the account. Reuses the
 * saved Stripe customer if one exists.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const priceId = supporterPriceId()
  if (!stripe || !priceId) {
    return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })
  }

  const user = await serverUser()
  if (!user) return NextResponse.redirect(new URL('/account', request.url))

  const existing = await getSubscriptionRow()
  const origin = new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : { customer_email: user.email ?? undefined }),
    success_url: `${origin}/account?supported=1`,
    cancel_url: `${origin}/support`,
    allow_promotion_codes: true,
  })

  if (!session.url) return NextResponse.json({ error: 'Could not start checkout.' }, { status: 502 })
  return NextResponse.redirect(session.url, { status: 303 })
}
