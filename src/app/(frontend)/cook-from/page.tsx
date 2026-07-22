import type { Metadata } from 'next'

import type { Recipe } from '@/payload-types'
import { PantryFinder } from '@/components/PantryFinder'
import { RecipeCard } from '@/components/RecipeCard'
import type { Have, Scored } from '@/lib/pantry'
import { findRecipesByPantry, getPayloadClient } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'What can I make?',
  description:
    'Add what is in your kitchen and Palate sorts the catalog into what you can cook now, what is one or two items away, and what is a bigger stretch.',
}

function parseSlugs(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return []
  return Array.from(new Set(value.split(',').map((s) => s.trim()).filter(Boolean)))
}

function parseTime(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = value ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Band section — hidden entirely when empty, so an unused band leaves no gap. */
function Band({ title, items }: { title: string; items: Scored<Recipe>[] }) {
  if (items.length === 0) return null
  return (
    <section>
      <p className="eyebrow m-0">{title}</p>
      <div className="mt-3 grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => (
          <div key={s.recipe.id}>
            <RecipeCard recipe={s.recipe} />
            {(s.missing.length > 0 || s.viaSub.length > 0) && (
              <div className="mt-2 grid gap-0.5 font-mono text-[0.75rem] text-slate">
                {s.missing.length > 0 && <p className="m-0">You’d still need: {s.missing.join(', ')}</p>}
                {s.viaSub.map((v) => (
                  <p key={`${v.item}-${v.sub}`} className="m-0">
                    use {v.sub} for {v.item}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * "What can I make?" — the pantry-first counterpart to the filter-first
 * catalog. Slugs live in the URL so the page can resolve them server-side and
 * stay linkable/reloadable; `PantryFinder` owns the client interaction.
 */
export default async function CookFromPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const slugs = parseSlugs(params.have)
  const maxMinutes = parseTime(params.time)

  let have: Have[] = []
  let initialHave: Array<{ slug: string; name: string }> = []
  if (slugs.length > 0) {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'ingredients',
      where: { slug: { in: slugs } },
      depth: 0,
      limit: 50,
    })
    have = result.docs.map((d) => ({ id: d.id, name: String(d.name) }))
    initialHave = result.docs.map((d) => ({ slug: String(d.slug), name: String(d.name) }))
  }

  const bands = await findRecipesByPantry(have, { maxMinutes })
  const hasInput = have.length > 0
  const totalResults = bands.cookNow.length + bands.almost.length + bands.gettingThere.length

  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[72rem]">
        <header className="max-w-[56ch]">
          <p className="eyebrow m-0">What can I make?</p>
          <h1 className="mt-1 text-[clamp(1.875rem,3vw,2.75rem)]">Cook from what you have.</h1>
          <p className="mt-3 text-slate">
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
              <Band title="Cook now" items={bands.cookNow} />
              <Band title="One or two away" items={bands.almost} />
              <Band title="Getting there" items={bands.gettingThere} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
