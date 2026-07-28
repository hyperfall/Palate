import type { Metadata } from 'next'
import Link from 'next/link'

import type { Recipe } from '@/payload-types'
import { PantryFinder } from '@/components/PantryFinder'
import { RecipeCard } from '@/components/RecipeCard'
import type { Have, Scored } from '@/lib/pantry'
import { getUserPantry } from '@/lib/planData'
import { findRecipesByPantry } from '@/lib/queries'
import { serverUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // Personalised and sign-in gated: to a crawler this is a thin sign-in
  // prompt, so keep it out of the index like every other private page.
  robots: { index: false, follow: false },
  title: 'What can I make?',
  description:
    'Add what is in your kitchen and Palate sorts the catalog into what you can cook now, what is one or two items away, and what is a bigger stretch.',
}

function parseTime(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = value ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Band section — hidden entirely when empty, so an unused band leaves no gap. */
function Band({ title, items, haveCount }: { title: string; items: Scored<Recipe>[]; haveCount: number }) {
  if (items.length === 0) return null
  return (
    <section>
      <p className="eyebrow m-0">{title}</p>
      <div className="mt-3 grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => (
          <div key={s.recipe.id}>
            <RecipeCard recipe={s.recipe} />
            <div className="mt-2 grid gap-0.5 font-mono text-[0.75rem] text-slate">
              <p className="m-0 text-flame">
                Uses {s.usedCount} of your {haveCount}
              </p>
              {s.missing.length > 0 && <p className="m-0">You’d still need: {s.missing.join(', ')}</p>}
              {s.viaSub.map((v) => (
                <p key={`${v.item}-${v.sub}`} className="m-0">
                  use {v.sub} for {v.item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * "What can I make?" — the pantry-first counterpart to the filter-first catalog.
 * The pantry is the signed-in user's saved ingredient list (Supabase); the page
 * reads it server-side and `PantryFinder` owns add/remove.
 */
export default async function CookFromPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const maxMinutes = parseTime(params.time)

  const user = await serverUser()
  if (!user) {
    return (
      <div className="shell py-14">
        <div className="max-w-[46ch]">
          <p className="eyebrow m-0">What can I make?</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Cook from what you have.</h1>
          <p className="mt-3 text-slate max-sm:hidden">
            Your pantry saves to your account, so it’s there every time. Sign in to add what’s in
            your kitchen.
          </p>
          <Link href="/account" className="btn-primary mt-6 inline-block">
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const pantry = await getUserPantry()
  const have: Have[] = pantry.filter((p) => p.id !== null).map((p) => ({ id: p.id as number, name: p.name }))
  const initialHave = pantry.map((p) => ({ slug: p.slug, name: p.name }))

  const bands = await findRecipesByPantry(have, { maxMinutes })
  const hasInput = pantry.length > 0
  const totalResults = bands.cookNow.length + bands.almost.length + bands.gettingThere.length

  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[72rem]">
        <header className="max-w-[56ch]">
          <p className="eyebrow m-0">What can I make?</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Cook from what you have.</h1>
          <p className="mt-3 text-slate max-sm:hidden">
            Add a few ingredients from your kitchen — the board sorts into what you can cook right
            now, what’s one or two items away, and what needs a bigger trip.
          </p>
        </header>

        <div className="mt-8">
          <PantryFinder initialHave={initialHave} initialTime={maxMinutes} />
        </div>

        <div className="mt-10">
          {!hasInput ? (
            <p className="text-slate">Add your first ingredient above to see what’s cookable.</p>
          ) : totalResults === 0 ? (
            <p className="text-slate">
              Nothing matches yet — try adding a common ingredient, or drop the time cap.
            </p>
          ) : (
            <div className="grid gap-10">
              <Band title="Cook now" items={bands.cookNow} haveCount={have.length} />
              <Band title="One or two away" items={bands.almost} haveCount={have.length} />
              <Band title="Getting there" items={bands.gettingThere} haveCount={have.length} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
