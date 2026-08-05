import type { Metadata } from 'next'
import Link from 'next/link'

import { getEntitlements } from '@/lib/entitlements'
import { stripeConfigured, SUPPORTER_PRICE_LABEL } from '@/lib/stripe'
import { serverUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  alternates: { canonical: '/support' },
  title: 'Become a supporter',
  description:
    'Support Palate, a recipe-first, honestly-monetised platform. Unlock Household mode and the perks to come, and help keep the recipe at the top.',
}

export const dynamic = 'force-dynamic'

const PERKS_NOW = [
  ['Household mode', 'Share one week board, pantry and shopping list with the people you cook for.'],
  ['An honest platform', 'Fund a recipe site with no life-story walls and no ad spam. The recipe stays first.'],
]
const PERKS_SOON = [
  ['Taste Night host mode', 'Run the quiz for a room, with join codes and group picks.'],
  ['Taste reports', 'A read on what your kitchen actually leans toward.'],
  ['Palate Kitchen', 'Our own tested recipes and collections, as the platform grows.'],
]

export default async function SupportPage() {
  const user = await serverUser()
  const entitlements = await getEntitlements()
  const isSupporter = entitlements.has('supporter')
  const configured = stripeConfigured()

  return (
    <div className="shell max-w-[68ch] py-8 lg:py-14">
      <header>
        <p className="eyebrow m-0 text-flame">Become a supporter</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)] leading-[1.1]">
          Keep the recipe at the top.
        </h1>
        <p className="mt-4 text-read leading-relaxed text-slate">
          Palate earns from clearly-labelled partner cards, never from burying the food. Supporters
          fund the rest, and get the tools built for people who cook for a household. It’s{' '}
          <span className="font-semibold text-ink">{SUPPORTER_PRICE_LABEL}</span>, cancel anytime.
        </p>
      </header>

      <div className="mt-8">
        {isSupporter ? (
          <div className="ticket-card p-5">
            <p className="eyebrow m-0 text-flame">You’re a supporter</p>
            <p className="mt-1 text-slate">Thank you. Manage your subscription from your account.</p>
            <Link href="/account" className="btn-primary mt-4 inline-block">
              Go to account →
            </Link>
          </div>
        ) : !user ? (
          <Link href="/account" className="btn-primary inline-block">
            Sign in to support
          </Link>
        ) : configured ? (
          <form action="/support/checkout" method="post">
            <button type="submit" className="btn-primary">
              Support Palate · {SUPPORTER_PRICE_LABEL}
            </button>
          </form>
        ) : (
          <div className="ticket-card p-5">
            <p className="m-0 text-slate">
              Supporter subscriptions aren’t switched on yet. Check back soon.
            </p>
          </div>
        )}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-[1.375rem] text-ink">What you unlock now</h2>
        <ul className="mt-4 grid list-none gap-3 p-0">
          {PERKS_NOW.map(([title, body]) => (
            <li key={title} className="border-t border-rule pt-3">
              <p className="m-0 font-display text-read text-ink">{title}</p>
              <p className="mt-1 text-slate">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[1.375rem] text-ink">Coming for supporters</h2>
        <ul className="mt-4 grid list-none gap-3 p-0">
          {PERKS_SOON.map(([title, body]) => (
            <li key={title} className="border-t border-rule pt-3">
              <p className="m-0 font-display text-read text-ink">{title}</p>
              <p className="mt-1 text-slate">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-note text-slate">
          Everything you use today stays free. Supporting only adds; it never takes a feature away.
        </p>
      </section>
    </div>
  )
}
