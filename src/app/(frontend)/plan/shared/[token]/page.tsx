import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { consolidateShoppingList } from '@/lib/mealPlan'
import { loadPlannedRecipes } from '@/lib/planData'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'A shared week',
  robots: { index: false, follow: false },
}

/** Public, read-only view of a shared week — anyone with the link can see it. */
export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await supabaseServer()
  if (!supabase) notFound()

  const { data } = await supabase.from('plan_shares').select('recipe_slugs').eq('id', token).maybeSingle()
  if (!data) notFound()

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
        <h1 className="mt-1 text-[clamp(1.875rem,3vw,2.75rem)]">Someone’s meal plan.</h1>
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
