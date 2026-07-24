import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ShoppingList } from '@/components/ShoppingList'
import { WeekCard } from '@/components/WeekCard'
import { WeekCardActions } from '@/components/WeekCardActions'
import { buildDishShoppingList, buildWeekSnapshot, consolidateShoppingList, type WeekSnapshot } from '@/lib/mealPlan'
import { imageFrom } from '@/lib/media'
import { loadPlannedRecipes } from '@/lib/planData'
import { findRecipeBySlug } from '@/lib/queries'
import { supabaseServer } from '@/lib/supabase/server'

/** Demo week for previewing the card: meals split, a two-dish dinner, an open
 *  day. (day 0=Mon…6=Sun) */
const SAMPLE: Array<{ day: number; meal: string; slug: string }> = [
  { day: 0, meal: 'breakfast', slug: 'weeknight-shakshuka' },
  { day: 0, meal: 'dinner', slug: 'butter-chicken' },
  { day: 1, meal: 'dinner', slug: 'smashed-cucumber-salad' },
  { day: 2, meal: 'dinner', slug: 'oyakodon' },
  { day: 2, meal: 'dinner', slug: 'mapo-tofu' },
  { day: 3, meal: 'dinner', slug: 'bibimbap-with-gochujang-sauce' },
  { day: 4, meal: 'lunch', slug: 'som-tam' },
  { day: 6, meal: 'dinner', slug: 'chana-masala' },
]

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'A shared week',
  robots: { index: false, follow: false },
}

/** Public, read-only view of a shared week — anyone with the link can see it. */
export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Preview the card look without a real share (both /plan and real shares are
  // auth/cloud-gated). Builds a week from real catalog recipes.
  if (token === 'sample') {
    const planned = await loadPlannedRecipes(SAMPLE.map((s) => s.slug))
    const entries = []
    for (let i = 0; i < SAMPLE.length; i++) {
      const s = SAMPLE[i]
      const recipe = await findRecipeBySlug(s.slug)
      if (!recipe) continue
      entries.push({
        day: s.day,
        meal: s.meal,
        slug: s.slug,
        title: recipe.title,
        image: imageFrom(recipe.heroImage, 'card')?.url ?? null,
        position: i,
        ingredients: planned.get(s.slug)?.ingredients ?? [],
      })
    }
    const week = buildWeekSnapshot(entries, { title: 'A week on Palate', weekOf: 'Week of 21 July' })
    const shopping = buildDishShoppingList(week)
    return (
      <div className="shell py-10 lg:py-14">
        <WeekCard week={week} />
        <div className="mx-auto mt-8 max-w-[40rem]">
          <ShoppingList list={shopping} interactive={false} />
        </div>
        <WeekCardActions week={week} shopping={shopping} />
      </div>
    )
  }

  const supabase = await supabaseServer()
  if (!supabase) notFound()

  const { data } = await supabase.from('plan_shares').select('recipe_slugs, week').eq('id', token).maybeSingle()
  if (!data) notFound()

  // New shares snapshot the structured week → render the card + shopping list.
  if (data.week) {
    const week = data.week as WeekSnapshot
    const shopping = buildDishShoppingList(week)
    return (
      <div className="shell py-10 lg:py-14">
        <WeekCard week={week} />
        <div className="mx-auto mt-8 max-w-[40rem]">
          <ShoppingList list={shopping} interactive={false} />
        </div>
        <WeekCardActions week={week} shopping={shopping} />
        <p className="mt-6 text-center text-[0.9375rem] text-slate">
          Want your own?{' '}
          <Link href="/plan" className="text-flame underline underline-offset-4">
            Plan your week on Palate
          </Link>
          .
        </p>
      </div>
    )
  }

  const slugs = ((data.recipe_slugs as string[] | null) ?? []).filter(Boolean)
  const recipes = await loadPlannedRecipes(slugs)
  const planned = slugs.map((s) => ({ slug: s, title: recipes.get(s)?.title ?? s }))
  const shopping = consolidateShoppingList(
    slugs.map((s) => ({ title: recipes.get(s)?.title ?? s, ingredients: recipes.get(s)?.ingredients ?? [] })),
  )

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">A shared week</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Someone’s meal plan.</h1>
        <p className="mt-3 text-slate">
          The recipes and one consolidated shopping list. Want your own?{' '}
          <Link href="/plan" className="text-flame underline underline-offset-4">
            Plan your week
          </Link>
          .
        </p>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div>
          <h2 className="border-t-2 border-ink pt-4 text-[1.5rem]">Recipes</h2>
          <ul className="mt-4 grid list-none gap-2 p-0">
            {planned.map((p) => (
              <li key={p.slug}>
                <Link href={`/recipes/${p.slug}`} className="text-[1.0625rem] no-underline hover:text-flame">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <aside>
          <h2 className="border-t-2 border-ink pt-4 text-[1.5rem]">Shopping list</h2>
          <ul className="mt-4 grid list-none gap-2.5 p-0">
            {shopping.map((line) => (
              <li key={line.key} className="border-b border-rule pb-2 text-[1.0625rem]">
                {line.name}
                {line.amounts.length > 0 && <span className="text-slate"> — {line.amounts.join(' + ')}</span>}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
