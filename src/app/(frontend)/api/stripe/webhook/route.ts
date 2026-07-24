import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'

import { getStripe } from '@/lib/stripe'
import { rowFromSubscription } from '@/lib/stripeWebhook'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Stripe webhook → subscriptions table. The ONLY writer of that table: the
 * signature is verified against STRIPE_WEBHOOK_SECRET, then the subscription is
 * upserted via the service-role client (RLS grants no client writes).
 *
 * Runs on the Node runtime with the raw body preserved — signature verification
 * needs the exact bytes Stripe signed.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const admin = supabaseAdmin()
  if (!stripe || !secret || !admin) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    console.error('[stripe] signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (userId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const { error } = await admin.from('subscriptions').upsert(rowFromSubscription(sub, userId))
          if (error) throw error
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        // No user id on these events — update the existing row by subscription id.
        const { error } = await admin
          .from('subscriptions')
          .update(rowFromSubscription(sub))
          .eq('stripe_subscription_id', sub.id)
        if (error) throw error
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe] webhook handler error:', err)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
