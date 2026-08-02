import type { Metadata } from 'next'
import Link from 'next/link'

import type { Recipe } from '@/payload-types'
import { PantryFinder } from '@/components/PantryFinder'
import { RecipeCard } from '@/components/RecipeCard'
import type { Have, Scored } from '@/lib/pantry'
import { getUserPantry, resolvePantrySlugs } from '@/lib/planData'
import { findRecipesByPantry } from '@/lib/queries'
import { serverUser } from '@/lib/supabase/server'
import { AddToPlan } from '@/components/AddToPlan'
import { imageFrom } from '@/lib/media'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: { canonical: '/cook-from' },
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
            <div className="mt-2 grid gap-0.5 font-mono text-caption text-slate">
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
            {/* Deciding to cook it was the whole point of the page; making that
                a trip through the recipe page just to reach the planner put two
                navigations between the answer and the act. */}
            <div className="mt-2.5">
              <AddToPlan
                slug={s.recipe.slug}
                title={s.recipe.title}
                image={imageFrom(s.recipe.heroImage, 'card')?.url ?? null}
                // Up to 72 of these render here; each eager lookup is three
                // round trips. They load when opened instead.
                eager={false}
              />
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

  // Signed out, the pantry lives in the URL. The feature that most sets this
  // site apart used to be a sign-in wall with nothing behind it — a first-time
  // visitor could not see what it did, let alone why it was worth an account.
  // Now they can use it outright; signing in is what makes it persist.
  if (!user) {
    const slugs = [...new Set(String(params.have ?? '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 40)
    const guestPantry = await resolvePantrySlugs(slugs.map((slug) => ({ slug })))
    const guestHave: Have[] = guestPantry
      .filter((p) => p.id !== null)
      .map((p) => ({ id: p.id as number, name: p.name }))
    const guestBands = guestHave.length > 0 ? await findRecipesByPantry(guestHave, { maxMinutes }) : null
    const guestTotal = guestBands
      ? guestBands.cookNow.length + guestBands.almost.length + guestBands.gettingThere.length
      : 0

    return (
      <div className="shell py-10 lg:py-14">
        <div className="max-w-[72rem]">
          <header className="max-w-[56ch]">
            <p className="eyebrow m-0">What can I make?</p>
            <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Cook from what you have.</h1>
            <p className="mt-3 text-slate max-sm:hidden">
              Add a few things from your kitchen — the board sorts into what you can cook right
              now, what’s an item or two away, and what needs a bigger trip.
            </p>
          </header>

          <div className="mt-8">
            <PantryFinder initialHave={guestPantry} initialTime={maxMinutes} guest />
          </div>

          {guestBands ? (
            <>
              <p className="mt-6 font-mono text-detail text-slate">
                {guestTotal === 0
                  ? 'Nothing matches yet — add another ingredient.'
                  : `${guestTotal} ${guestTotal === 1 ? 'recipe' : 'recipes'} from ${guestHave.length} ${guestHave.length === 1 ? 'ingredient' : 'ingredients'}.`}
              </p>
              <div className="mt-8 grid gap-12">
                <Band title="Cook now" items={guestBands.cookNow} haveCount={guestHave.length} />
                <Band title="One or two away" items={guestBands.almost} haveCount={guestHave.length} />
                <Band title="Getting there" items={guestBands.gettingThere} haveCount={guestHave.length} />
              </div>
            </>
          ) : (
            <p className="mt-6 max-w-[52ch] text-slate">
              Start with two or three staples — an onion, a tin of tomatoes, whatever’s actually in
              there.
            </p>
          )}

          <p className="mt-12 border-t border-rule pt-6 text-note text-slate">
            This pantry lasts as long as the page.{' '}
            <Link href="/account" className="text-flame underline underline-offset-4">
              Sign in
            </Link>{' '}
            and it saves to your account, ready every time you cook.
          </p>
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
