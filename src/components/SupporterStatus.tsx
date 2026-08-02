import Link from 'next/link'

import { getEntitlements, getSubscriptionRow } from '@/lib/entitlements'
import { stripeConfigured, SUPPORTER_PRICE_LABEL } from '@/lib/stripe'
import { serverUser } from '@/lib/supabase/server'

/**
 * Supporter tier row on the account page. Server-rendered (entitlements live
 * server-side); shows nothing when signed out — AccountPanel owns that state.
 * A supporter gets a Manage button (Stripe portal); everyone else gets the
 * pitch. Hidden entirely until payments are configured, so a fresh deploy
 * doesn't advertise a tier that can't be bought.
 */
export async function SupporterStatus() {
  const user = await serverUser()
  if (!user || !stripeConfigured()) return null

  const entitlements = await getEntitlements()
  const isSupporter = entitlements.has('supporter')
  const row = await getSubscriptionRow()

  return (
    <div className="ticket-card mt-6 max-w-[36rem] p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow m-0">Membership</p>
        <span
          className={`font-mono text-tag tracking-[0.12em] uppercase ${isSupporter ? 'text-flame' : 'text-slate'}`}
        >
          {isSupporter ? 'Supporter' : 'Free'}
        </span>
      </div>

      {isSupporter ? (
        <>
          <p className="mt-2 text-note text-slate">
            Thank you for supporting Palate. Household mode and supporter perks are unlocked.
          </p>
          {row?.stripe_customer_id && (
            <form action="/support/portal" method="post" className="mt-4">
              <button
                type="submit"
                className="font-mono text-detail tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
              >
                Manage subscription →
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-note text-slate">
            Unlock Household mode and the perks to come — {SUPPORTER_PRICE_LABEL}, cancel anytime.
          </p>
          <Link href="/support" className="btn-primary mt-4 inline-block">
            Become a supporter →
          </Link>
        </>
      )}
    </div>
  )
}
