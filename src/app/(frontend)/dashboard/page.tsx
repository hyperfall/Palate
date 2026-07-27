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

async function pantryCount(): Promise<number> {
  const supabase = await supabaseServer()
  if (!supabase) return 0
  const { count } = await supabase.from('pantry').select('id', { count: 'exact', head: true })
  return count ?? 0
}

/**
 * The last few saves, straight from Supabase — collection_items carries slug,
 * title and image, so no Payload join. Deduped by slug (the same recipe can
 * sit on several shelves).
 */
async function recentSaves(): Promise<Array<{ slug: string; title: string; image: string | null }>> {
  const supabase = await supabaseServer()
  if (!supabase) return []
  const { data } = await supabase
    .from('collection_items')
    .select('recipe_slug,recipe_title,recipe_image,created_at')
    .order('created_at', { ascending: false })
    .limit(12)
  const out: Array<{ slug: string; title: string; image: string | null }> = []
  const seen = new Set<string>()
  for (const row of data ?? []) {
    if (seen.has(row.recipe_slug)) continue
    seen.add(row.recipe_slug)
    out.push({ slug: row.recipe_slug, title: row.recipe_title, image: row.recipe_image ?? null })
    if (out.length === 4) break
  }
  return out
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
  const [saved, planEntries, household, pantry, recent] = await Promise.all([
    savedCount(),
    getPlanEntries(),
    getHouseholdContext(),
    pantryCount(),
    recentSaves(),
  ])

  return (
    <Shell name={(user.user_metadata?.display_name as string | undefined) ?? user.email}>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <OverviewCard
          href="/cook-from"
          label="Pantry"
          value={String(pantry)}
          hint={pantry === 1 ? 'ingredient in the house' : 'ingredients in the house'}
        />
      </div>

      {/* The dashboard is a hub — the doors into the kitchen belong on it. */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/tonight" className="chip no-underline">
          Pick dinner for me →
        </Link>
        <Link href="/cook-from" className="chip no-underline">
          Cook from what’s in →
        </Link>
        <Link href="/plan" className="chip no-underline">
          Plan the week →
        </Link>
        {creator && (
          <Link href="/studio" className="chip no-underline">
            Open the studio →
          </Link>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mt-12 border-t border-rule pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 text-[1.25rem]">Recently saved</h2>
            <Link
              href="/collections"
              className="font-mono text-[0.75rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
            >
              All shelves →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {recent.map((r) => (
              <Link
                key={r.slug}
                href={`/recipes/${r.slug}`}
                className="ticket-card group overflow-hidden no-underline"
              >
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- saved-recipe thumbnail URL from Supabase
                  <img src={r.image} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="aspect-[4/3] w-full bg-wash" />
                )}
                <p className="m-0 p-3 text-[0.9375rem] leading-snug font-semibold text-ink group-hover:text-flame">
                  {r.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

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
