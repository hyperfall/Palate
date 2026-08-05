import type { Metadata } from 'next'
import Link from 'next/link'

import { CatalogGrid } from '@/components/CatalogGrid'
import { FilterPanel, SortSelect } from '@/components/FilterPanel'
import { Pagination } from '@/components/Pagination'
import { catalogHref, hasActiveFilters, parseFilters, type RawSearchParams } from '@/lib/filters'
import { bestRelaxation, relaxations, type Relaxation } from '@/lib/relaxFilters'
import {
  countRecipesByCuisine,
  countRecipesByDietTag,
  findCuisines,
  findRecipes,
} from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'
import { ALLERGENS } from '@/lib/taxonomy'

export const metadata: Metadata = {
  title: 'All recipes',
  description:
    'Filter by how a dish actually tastes: heat, sweetness, richness, and how much effort it will cost you.',
  // Filters, sorts and pages are real crawlable links, so the catalog has a
  // near-infinite set of query-string variants. They all point back here, or
  // Google splits the ranking signal across permutations of the same page.
  alternates: { canonical: absoluteUrl('/recipes') },
}

const PAGE_SIZE = 12

/**
 * The catalog is a workspace, not a landing page: a slim title rail, a sticky
 * filter station on the left, and a results grid that adds columns as the
 * screen gives it room — four at laptop width, six on a 1920 display.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const params = await searchParams
  const filters = parseFilters(params)
  // The feed re-parses the same grammar server-side; page is appended per fetch.
  const feedPairs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || value == null) continue
    for (const v of Array.isArray(value) ? value : [value]) feedPairs.append(key, v)
  }
  const feedQuery = feedPairs.toString()

  const [{ recipes, totalDocs, totalPages, page, correctedFrom }, cuisines, cuisineCounts, dietCounts] =
    await Promise.all([
      findRecipes(filters, { page: filters.page, limit: PAGE_SIZE }),
      findCuisines(),
      countRecipesByCuisine(),
      countRecipesByDietTag(),
    ])

  // Nothing matched: work out which single constraint is doing the excluding,
  // so the empty state can offer a fix instead of advice. Only runs on this
  // path, and each candidate is a limit-1 count rather than a page of results.
  let relaxed: Relaxation | null = null
  if (recipes.length === 0 && hasActiveFilters(filters)) {
    const counted = await Promise.all(
      relaxations(filters)
        .slice(0, 8)
        .map(async (c) => ({ ...c, count: (await findRecipes(c.filters, { page: 1, limit: 1 })).totalDocs })),
    )
    relaxed = bestRelaxation(counted)
  }

  // With 200+ world cuisines seeded, only offer filter chips for the ones
  // that have recipes — a "Tuvaluan" chip that always returns nothing is
  // noise. A currently-selected cuisine stays listed so the filter never
  // silently drops the user's own choice.
  const filterableCuisines = cuisines.filter(
    (c) => (cuisineCounts.get(String(c.id)) ?? 0) > 0 || filters.cuisines.includes(c.slug),
  )

  // Same rule for allergens: an "Avoiding: Nuts" chip is only honest if some
  // recipe is actually tagged nut-free. Untagged allergens stay hidden until
  // coverage exists (a currently-selected one is always kept).
  const availableAllergens = ALLERGENS.filter(
    (a) => (dietCounts.get(a.tag) ?? 0) > 0 || filters.diets.includes(a.tag),
  ).map((a) => a.tag)

  return (
    <div className="shell py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-2 border-ink pb-5">
        <div>
          <p className="eyebrow m-0">The board</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">
            Filter by taste, not just by ingredient.
          </h1>
        </div>
        <p className="m-0 max-w-[44ch] text-note leading-snug text-slate max-sm:hidden">
          Every recipe is measured on four axes. Pick the band you actually want tonight, from
          “no heat at all” to “nothing short of fiery”.
        </p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12 2xl:grid-cols-[19rem_minmax(0,1fr)]">
        <FilterPanel
          filters={filters}
          cuisines={filterableCuisines.map((c) => ({
            name: c.name,
            slug: c.slug,
            flagEmoji: c.flagEmoji,
          }))}
          availableAllergens={availableAllergens}
        />

        <section>
          {/* Announced to screen readers on every filter change, at all
              breakpoints (the visible count below is desktop-only + aria-hidden). */}
          <p className="sr-only" role="status" aria-live="polite">
            {correctedFrom
              ? `No exact match for ${correctedFrom}. Showing ${totalDocs} close ${totalDocs === 1 ? 'match' : 'matches'}.`
              : `${totalDocs} ${totalDocs === 1 ? 'recipe' : 'recipes'} match your filters`}
          </p>

          {/* Say that the spelling was forgiven. Silently answering a different
              question than the one typed is how a search loses trust — and the
              exact term still deserves to be shown, in case the guess is wrong. */}
          {correctedFrom && (
            <p className="mb-4 text-note text-slate">
              Nothing matched <span className="text-ink">“{correctedFrom}”</span> exactly. Showing
              the closest {totalDocs === 1 ? 'recipe' : 'recipes'}.
            </p>
          )}
          <div className="hidden flex-wrap items-baseline justify-between gap-4 pb-4 lg:flex">
            <p className="datum m-0" aria-hidden="true">
              {totalDocs} {totalDocs === 1 ? 'recipe' : 'recipes'}
              {/* "18 recipes" over 12 visible cards read as a broken page — a
                  user-journey agent looked for the other six and found no hint
                  that scrolling was the answer. */}
              {totalDocs > recipes.length && (
                <span className="ml-2 font-mono text-tag tracking-[0.08em] text-slate uppercase">
                  showing {recipes.length}, more load as you scroll
                </span>
              )}
            </p>
            <SortSelect filters={filters} />
          </div>

          {recipes.length === 0 ? (
            /* An empty screen is an invitation to act, not an apology. */
            <div className="ticket-card mt-6 px-6 py-16 text-center">
              <p className="m-0 font-display text-xl">Nothing matches all of that.</p>
              {relaxed ? (
                <>
                  <p className="mx-auto mt-3 max-w-[42ch] text-slate">
                    Drop {relaxed.label} and there {relaxed.count === 1 ? 'is' : 'are'} {relaxed.count}.
                  </p>
                  <Link href={catalogHref(relaxed.filters)} className="btn-primary mt-6">
                    Drop {relaxed.label}
                  </Link>
                </>
              ) : (
                <p className="mx-auto mt-3 max-w-[42ch] text-slate">
                  Nothing comes back however this is loosened. The board is still small.
                </p>
              )}
              {hasActiveFilters(filters) && (
                <div className="mt-4">
                  <Link
                    href="/recipes"
                    className="font-mono text-caption tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
                  >
                    Clear everything
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <CatalogGrid
                key={`${feedQuery}|${page}`}
                initial={recipes}
                page={page}
                totalPages={totalPages}
                feedQuery={feedQuery}
              />
              {/* Crawlers and no-JS readers still get walkable pages. */}
              <noscript>
                <Pagination filters={filters} page={page} totalPages={totalPages} />
              </noscript>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
