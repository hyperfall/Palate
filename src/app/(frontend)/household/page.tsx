import type { Metadata } from 'next'
import Link from 'next/link'

import { HouseholdInvite } from '@/components/HouseholdInvite'
import { getEntitlements } from '@/lib/entitlements'
import { getHouseholdContext } from '@/lib/household'
import { serverUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Household',
  description: 'Share one week board, pantry and shopping list with the people you cook for.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>
}) {
  const { join } = await searchParams
  const user = await serverUser()

  if (!user) {
    return (
      <Shell>
        <p className="mt-4 text-slate">
          <Link href="/account" className="text-flame underline underline-offset-4">
            Sign in
          </Link>{' '}
          to share a plan with your household.
        </p>
      </Shell>
    )
  }

  const context = await getHouseholdContext()

  // In a household → management view.
  if (context) {
    return (
      <Shell>
        <div className="ticket-card mt-6 max-w-[38rem] p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.375rem] text-ink">{context.name}</h2>
            <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-slate uppercase">
              {context.members.length} {context.members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <p className="mt-1 text-[0.9375rem] text-slate">
            Everyone here shares one week board, pantry and shopping list. Your personal plan is kept
            and returns if you leave.
          </p>

          <div className="mt-5 border-t border-rule pt-4">
            <HouseholdInvite code={context.inviteCode} />
          </div>

          <ul className="mt-5 grid list-none gap-2 border-t border-rule p-0 pt-4">
            {context.members.map((m) => (
              <li key={m.userId} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                <span className="text-ink">
                  {m.userId === user.id ? 'You' : `Member ${m.userId.slice(0, 8)}`}
                </span>
                <span className="font-mono text-[0.6875rem] tracking-[0.1em] text-slate uppercase">{m.role}</span>
              </li>
            ))}
          </ul>

          <form action="/household/leave" method="post" className="mt-6 border-t border-rule pt-4">
            <button
              type="submit"
              className="font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
            >
              {context.isOwner ? 'Disband household →' : 'Leave household →'}
            </button>
            {context.isOwner && (
              <p className="mt-2 text-[0.8125rem] text-slate">
                Disbanding removes the shared week for everyone; each person keeps their own plan.
              </p>
            )}
          </form>
        </div>

        <Link href="/plan" className="mt-6 inline-block text-flame underline underline-offset-4">
          Go to the shared week →
        </Link>
      </Shell>
    )
  }

  // Not in a household → create (supporter) + join.
  const entitlements = await getEntitlements()
  const isSupporter = entitlements.has('supporter')

  return (
    <Shell>
      {join === 'invalid' && <Note>That invite code didn’t match a household. Check it and try again.</Note>}
      {join === 'already' && <Note>You’re already in a household — leave it first to join another.</Note>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="ticket-card p-5">
          <h2 className="font-display text-[1.25rem] text-ink">Start a household</h2>
          <p className="mt-1 text-[0.9375rem] text-slate">Share your week with the people you cook for.</p>
          {isSupporter ? (
            <form action="/household/create" method="post" className="mt-4 grid gap-2">
              <input
                name="name"
                placeholder="Our kitchen"
                maxLength={60}
                className="rounded border border-rule bg-transparent px-2 py-1.5 text-[0.9375rem] text-ink"
              />
              <button type="submit" className="btn-primary">
                Create household
              </button>
            </form>
          ) : (
            <div className="mt-4">
              <p className="text-[0.875rem] text-slate">Household mode is a supporter perk.</p>
              <Link href="/support" className="btn-primary mt-3 inline-block">
                Become a supporter →
              </Link>
            </div>
          )}
        </div>

        <div className="ticket-card p-5">
          <h2 className="font-display text-[1.25rem] text-ink">Join one</h2>
          <p className="mt-1 text-[0.9375rem] text-slate">Got an invite code? Joining is free.</p>
          <form action="/household/join" method="post" className="mt-4 grid gap-2">
            <input
              name="code"
              placeholder="Invite code"
              required
              className="rounded border border-rule bg-transparent px-2 py-1.5 font-mono tracking-[0.1em] text-ink uppercase"
            />
            <button type="submit" className="btn-primary">
              Join household
            </button>
          </form>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell max-w-[60ch] py-8 lg:py-14">
      <header className="max-w-[46ch]">
        <p className="eyebrow m-0 text-flame">Household</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)] leading-[1.1]">Cook for a household.</h1>
      </header>
      {children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded border border-flame/40 bg-flame/5 px-3 py-2 text-[0.9375rem] text-ink" role="alert">
      {children}
    </p>
  )
}
