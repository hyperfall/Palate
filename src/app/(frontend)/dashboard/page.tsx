import type { Metadata } from 'next'
import Link from 'next/link'

import { CreatorRecipes } from '@/components/CreatorRecipes'
import { MyEarnings } from '@/components/MyEarnings'
import { getHouseholdContext } from '@/lib/household'
import { getPlanEntries } from '@/lib/planData'
import { isCreator, serverUser, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your recipes, your week, and your saved shelves in one place.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

async function savedCount(): Promise<number> {
  const supabase = await supabaseServer()
  if (!supabase) return 0
  const { count } = await supabase.from('collection_items').select('id', { count: 'exact', head: true })
  return count ?? 0
}

export default async function DashboardPage() {
  const user = await serverUser()

  if (!user) {
    return (
      <Shell>
        <p className="mt-4 text-slate">
          <Link href="/account" className="text-flame underline underline-offset-4">
            Sign in
          </Link>{' '}
          to see your dashboard.
        </p>
      </Shell>
    )
  }

  const creator = isCreator(user)
  const [saved, planEntries, household] = await Promise.all([
    savedCount(),
    getPlanEntries(),
    getHouseholdContext(),
  ])

  return (
    <Shell name={(user.user_metadata?.display_name as string | undefined) ?? user.email}>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <OverviewCard
          href="/collections"
          label="Saved"
          value={String(saved)}
          hint={saved === 1 ? 'recipe on your shelves' : 'recipes on your shelves'}
        />
        <OverviewCard
          href="/plan"
          label="This week"
          value={String(planEntries.length)}
          hint={planEntries.length === 1 ? 'dish planned' : 'dishes planned'}
        />
        <OverviewCard
          href="/household"
          label="Household"
          value={household ? household.name : '—'}
          hint={household ? `${household.members.length} sharing` : 'cook with others'}
        />
      </div>

      {creator && (
        <>
          <div className="mt-12 border-t border-rule pt-8">
            <CreatorRecipes />
          </div>
          <div className="mt-12 border-t border-rule pt-8">
            <MyEarnings />
          </div>
        </>
      )}
    </Shell>
  )
}

function Shell({ children, name }: { children: React.ReactNode; name?: string | null }) {
  return (
    <div className="shell py-8 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0 text-flame">Dashboard</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)] leading-[1.1]">
          {name ? `Welcome back, ${name}.` : 'Your dashboard.'}
        </h1>
      </header>
      {children}
    </div>
  )
}

function OverviewCard({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <Link
      href={href}
      className="ticket-card group flex flex-col gap-1 p-5 no-underline transition-colors hover:border-flame"
    >
      <span className="eyebrow">{label}</span>
      <span className="truncate font-display text-[1.75rem] leading-none text-ink group-hover:text-flame">
        {value}
      </span>
      <span className="font-mono text-[0.6875rem] tracking-[0.06em] text-slate">{hint}</span>
    </Link>
  )
}
