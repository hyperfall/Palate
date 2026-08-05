import type { Metadata } from 'next'
import Link from 'next/link'

import { formatPlatePrice } from '@/lib/format'
import { GroceryPanel } from '@/components/GroceryPanel'
import { MealBoard } from '@/components/MealBoard'
import { ShoppingModeLauncher } from '@/components/ShoppingMode'
import { getHouseholdContext } from '@/lib/household'
import { SharePlan } from '@/components/SharePlan'
import { ShoppingList } from '@/components/ShoppingList'
import { buildDishShoppingList, buildWeekSnapshot, formatWeekOf, scaleIngredients, weeklyCost } from '@/lib/mealPlan'
import { getPantryStaples, getPlanEntries, loadPlannedRecipes } from '@/lib/planData'
import { serverUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  // Personalised and sign-in gated: to a crawler this is a thin sign-in
  // prompt, so keep it out of the index like every other private page.
  robots: { index: false, follow: false },
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
          <Link href="/account?next=/plan" className="btn-primary mt-6 inline-block">
            Sign in to plan
          </Link>
        </div>
      </div>
    )
  }

  const entries = await getPlanEntries()
  const recipes = await loadPlannedRecipes(entries.map((e) => e.slug))
  const pantry = await getPantryStaples()
  const household = await getHouseholdContext()

  // Effective servings per entry (planned, else the recipe's own default), and
  // the factor that scales its ingredients + cost.
  const withServings = entries.map((e) => {
    const r = recipes.get(e.slug)
    const base = r?.servings ?? 1
    const planned = e.servings ?? base
    return { entry: e, base, planned, factor: base > 0 ? planned / base : 1, recipe: r }
  })

  // A single ingredient-carrying snapshot drives the share, the shopping list,
  // and (once shared) the card + exports — ingredients scaled to planned servings.
  const displayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null
  const week = buildWeekSnapshot(
    withServings.map(({ entry, planned, factor, recipe }) => ({
      ...entry,
      servings: planned,
      ingredients: scaleIngredients(recipe?.ingredients ?? [], factor),
    })),
    {
      title: household ? household.name : displayName ? `${displayName}’s week` : 'My week',
      weekOf: formatWeekOf(new Date()),
    },
  )
  const shopping = buildDishShoppingList(week, pantry)
  const cost = weeklyCost(
    withServings.map(({ recipe, planned }) => ({ costPerServing: recipe?.costPerServing ?? null, servings: planned })),
  )
  // One leftover hint per distinct planned recipe that has one.
  const leftovers = [...new Map(entries.map((e) => [e.slug, { title: e.title, idea: recipes.get(e.slug)?.leftoverIdeas }])).values()].filter(
    (x): x is { title: string; idea: string } => Boolean(x.idea),
  )

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">{household ? household.name : 'Your week'}</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Plan the week.</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Add recipes to days from any recipe page. The shopping list nets what overlaps and drops
          what you’ve marked as a staple.
        </p>

        {/*
          Cooking together is a headline mode, but it used to be an 11px slate
          link in the header's top corner — quieter than every other control on
          the page. It now carries chip weight beside the week's other actions:
          a flame invitation when you're solo, a plain status badge when shared.
        */}
        <div className="mt-5">
          <Link
            href="/household"
            className={`group inline-flex min-h-[2.125rem] items-center gap-2 rounded-[4px] border px-3 py-[0.4375rem] font-mono text-caption font-medium tracking-[0.06em] uppercase no-underline transition-colors ${
              household
                ? 'border-rule bg-wash text-ink hover:border-ink'
                : 'border-flame/40 bg-flame/10 text-flame hover:border-flame hover:bg-flame hover:text-on-flame'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
              <circle cx="10" cy="7.5" r="3.2" />
              <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
              <path d="M15.5 4.7a3.2 3.2 0 0 1 0 5.9" />
            </svg>
            {household
              ? `Shared · ${household.members.length} cook${household.members.length === 1 ? '' : 's'}`
              : 'Cook with others'}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        {entries.length > 0 && (
          <div className="mt-3">
            <SharePlan week={week} />
          </div>
        )}
      </header>

      <div className="mt-8">
        <MealBoard
          entries={withServings.map(({ entry, base, planned, recipe }) => ({
            ...entry,
            image: recipe?.image ?? entry.image,
            servings: planned,
            baseServings: base,
          }))}
        />
      </div>

      <div className="mt-14 grid gap-10 border-t-2 border-ink pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)]">
        {/* min-w-0: the lg columns use minmax(0,…) but on one column this child
            keeps a grid item's default min-width:auto, so the cost figure beside
            "Shopping list" could not wrap and pushed the page 36px sideways. */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[1.5rem]">Shopping list</h2>
            {/*
                This is the cost of COOKING the week — every plate counted at
                its own estimate — and it sat unlabelled beside "Shopping list",
                where it read as the price of the shop. It is not: the list
                below nets overlapping ingredients to a single line and drops
                everything already in the pantry, neither of which this number
                knows about, so the actual shop is always less. Saying which
                one it is costs a word.
            */}
            {cost.covered > 0 && (
              <span className="text-right">
                <span className="datum">≈ {formatPlatePrice(cost.totalCents)}</span>
                <span className="ml-1.5 font-mono text-tag tracking-[0.06em] text-slate uppercase">
                  to cook
                  {cost.covered < cost.total && ` · ${cost.covered}/${cost.total} priced`}
                </span>
              </span>
            )}
          </div>
          <ShoppingModeLauncher list={shopping} />
          <ShoppingList list={shopping} />
          <GroceryPanel lines={shopping.netted} />
        </div>

        {leftovers.length > 0 && (
          <aside className="lg:border-l lg:border-rule lg:pl-8">
            <p className="eyebrow m-0">Leftover chains</p>
            <ul className="mt-3 grid list-none gap-2.5 p-0">
              {leftovers.map((l) => (
                <li key={l.title} className="text-note leading-snug">
                  <span className="font-semibold">{l.title}</span> →{' '}
                  <span className="text-slate">{l.idea}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}
