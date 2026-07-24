import type { Metadata } from 'next'
import Link from 'next/link'

import { MealBoard } from '@/components/MealBoard'
import { SharePlan } from '@/components/SharePlan'
import { ShoppingList } from '@/components/ShoppingList'
import { buildDishShoppingList, buildWeekSnapshot, weeklyCost } from '@/lib/mealPlan'
import { getPantryStaples, getPlanEntries, loadPlannedRecipes } from '@/lib/planData'
import { serverUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Your week',
  description: 'Plan the week and get one consolidated shopping list — overlapping ingredients netted, pantry staples dropped.',
}

export const dynamic = 'force-dynamic'

export default async function PlanPage() {
  const user = await serverUser()

  if (!user) {
    return (
      <div className="shell py-14">
        <div className="max-w-[46ch]">
          <p className="eyebrow m-0">Your week</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Plan the week.</h1>
          <p className="mt-3 text-slate max-sm:hidden">
            Assign recipes to days and get one shopping list — overlaps netted, staples dropped. Your
            plan saves to your account.
          </p>
          <Link href="/account" className="btn-primary mt-6 inline-block">
            Sign in to plan
          </Link>
        </div>
      </div>
    )
  }

  const entries = await getPlanEntries()
  const recipes = await loadPlannedRecipes(entries.map((e) => e.slug))
  const pantry = await getPantryStaples()

  // A single ingredient-carrying snapshot drives the share, the shopping list,
  // and (once shared) the card + exports.
  const week = buildWeekSnapshot(entries.map((e) => ({ ...e, ingredients: recipes.get(e.slug)?.ingredients ?? [] })))
  const shopping = buildDishShoppingList(week, pantry)
  const cost = weeklyCost(
    entries.map((e) => {
      const r = recipes.get(e.slug)
      return { costPerServing: r?.costPerServing ?? null, servings: r?.servings ?? 1 }
    }),
  )
  // One leftover hint per distinct planned recipe that has one.
  const leftovers = [...new Map(entries.map((e) => [e.slug, { title: e.title, idea: recipes.get(e.slug)?.leftoverIdeas }])).values()].filter(
    (x): x is { title: string; idea: string } => Boolean(x.idea),
  )

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Your week</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Plan the week.</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Add recipes to days from any recipe page. The shopping list nets what overlaps and drops
          what you’ve marked as a staple.
        </p>
        {entries.length > 0 && (
          <div className="mt-4">
            <SharePlan week={week} />
          </div>
        )}
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <MealBoard entries={entries} />

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="border-t-2 border-ink pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[1.5rem]">Shopping list</h2>
              {cost.covered > 0 && (
                <span className="datum">
                  ≈ £{(cost.totalCents / 100).toFixed(2)}
                  {cost.covered < cost.total && (
                    <span className="ml-1 font-mono text-[0.6875rem] text-slate">
                      (from {cost.covered}/{cost.total})
                    </span>
                  )}
                </span>
              )}
            </div>
            <ShoppingList list={shopping} />
          </div>

          {leftovers.length > 0 && (
            <div className="mt-8 border-t border-rule pt-4">
              <p className="eyebrow m-0">Leftover chains</p>
              <ul className="mt-3 grid list-none gap-2.5 p-0">
                {leftovers.map((l) => (
                  <li key={l.title} className="text-[0.9375rem] leading-snug">
                    <span className="font-semibold">{l.title}</span> →{' '}
                    <span className="text-slate">{l.idea}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
