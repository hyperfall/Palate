import type { Metadata } from 'next'
import Link from 'next/link'

import { getActiveHouseholdId } from '@/lib/household'
import { serverUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Join a household',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Invite-link landing. A GET never mutates — it shows a confirm button that
 * POSTs the code to /household/join. Signed-out visitors are sent to sign in;
 * anyone already in a household is told to leave first.
 */
export default async function JoinHouseholdPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await serverUser()

  return (
    <div className="shell max-w-[52ch] py-10 lg:py-16">
      <p className="eyebrow m-0 text-flame">Household invite</p>
      <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.5rem)] leading-[1.1]">You’ve been invited to cook together.</h1>

      {!user ? (
        <p className="mt-5 text-slate">
          <Link href="/account" className="text-flame underline underline-offset-4">
            Sign in
          </Link>{' '}
          to accept this invite, then open the link again.
        </p>
      ) : (await getActiveHouseholdId()) ? (
        <p className="mt-5 text-slate">
          You’re already in a household. Leave it from{' '}
          <Link href="/household" className="text-flame underline underline-offset-4">
            your household page
          </Link>{' '}
          before joining another.
        </p>
      ) : (
        <form action="/household/join" method="post" className="mt-6 grid max-w-[20rem] gap-3">
          <input type="hidden" name="code" value={code} />
          <p className="m-0 text-slate">
            Joining shares one week board, pantry and shopping list. It’s free, and your own plan is
            kept.
          </p>
          <button type="submit" className="btn-primary">
            Join this household
          </button>
          <Link href="/plan" className="font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase hover:text-flame">
            No thanks →
          </Link>
        </form>
      )}
    </div>
  )
}
