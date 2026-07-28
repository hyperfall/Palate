import type { Metadata } from 'next'
import Link from 'next/link'

import { StudentBudgetBoard } from '@/components/StudentBudgetBoard'
import { imageFrom } from '@/lib/media'

import { parseFilters } from '@/lib/filters'
import { findRecipes } from '@/lib/queries'
import type { Recipe } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Studying hard?',
  description:
    'Proper food for tight budgets, busy weeks, and whoever turns up. Quick solo dinners, batch cooks, and feed-the-flat meals that scale.',
}

export const revalidate = 3600

/**
 * The student landing page. Not "budget cooking" branding — smart, capable,
 * social cooking for the actual context: low money, small kitchens, tired
 * evenings, and sometimes eight people at pre-drinks. The feeding-mode switch
 * lives in the URL; party modes link recipes pre-scaled via ?servings=.
 */
const MODES = [
  {
    key: 'solo',
    label: 'Just me',
    blurb: 'Under 30 minutes, minimal washing up, no sad desk dinners.',
    servingsHint: undefined as number | undefined,
    query: { time: '30', effort: '0-2' },
    filter: (r: Recipe) => (r.totalMinutes ?? 99) <= 30 && r.effort <= 2,
  },
  {
    key: 'batch',
    label: 'Me + tomorrow',
    blurb: 'Cook once, eat twice. Tomorrow-you says thanks.',
    servingsHint: undefined as number | undefined,
    query: { effort: '0-3' },
    filter: (r: Recipe) => r.servings >= 4 && r.effort <= 3,
  },
  {
    key: 'two',
    label: 'Two people',
    blurb: 'Date night or flatmate dinner — proper food, split shop.',
    servingsHint: 2,
    query: { effort: '0-3' },
    filter: (r: Recipe) => r.effort <= 3,
  },
  {
    key: 'party',
    label: 'People over',
    blurb: 'Big pans, shareable plates. Everything here opens pre-scaled for eight.',
    servingsHint: 8,
    query: { effort: '0-3' },
    filter: (r: Recipe) => r.servings >= 4 && r.effort <= 3,
  },
  {
    key: 'flat',
    label: 'Flat meal',
    blurb: 'Cheap, filling, one big pot. Feeds the flat without rinsing anyone.',
    servingsHint: 6,
    query: { effort: '0-2' },
    filter: (r: Recipe) => r.servings >= 4 && r.effort <= 2,
  },
] as const

type ModeKey = (typeof MODES)[number]['key']

const SHORTCUTS = [
  { label: 'Under 20 min', href: '/recipes?time=20', note: 'lecture-gap dinners' },
  { label: 'Effortless', href: '/recipes?effort=0-1', note: 'bare-minimum energy' },
  { label: 'Comfort', href: '/recipes?richness=3-5', note: 'deadline week food' },
  { label: 'Feeding the flat', href: '/students?mode=flat', note: 'one pot, many forks' },
]

const LEFTOVER_CHAINS = [
  { first: 'Butter chicken tonight', then: 'tomorrow it loads a jacket potato.' },
  { first: 'Extra rice on purpose', then: 'day-old rice makes the best fried rice.' },
  { first: 'A tray of roast veg', then: 'blitz half into tomorrow’s soup or wrap.' },
]

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode: rawMode } = await searchParams
  const mode = MODES.find((m) => m.key === (rawMode as ModeKey)) ?? MODES[0]

  // The time/effort half of each mode is a database question, so ask it there
  // rather than fetching 250 rows at depth 1 and discarding all but eight. The
  // JS predicate still runs — it also checks servings, which the catalog filter
  // grammar doesn't express — so the selection is unchanged, just cheaper.
  const { recipes } = await findRecipes(parseFilters(mode.query ?? {}), { limit: 60 })
  const picks = recipes.filter(mode.filter).slice(0, 8)

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[58ch]">
        <p className="eyebrow m-0">For students</p>
        <h1 className="mt-1 text-[clamp(2rem,3.5vw,3.25rem)]">Studying hard?</h1>
        <p className="mt-3 text-lg text-slate max-sm:hidden">
          Proper food for tight budgets, busy weeks, and whoever turns up.
        </p>
      </header>

      {/* Who are you feeding? — the page's primary control, URL-backed. */}
      <section className="mt-10">
        <p className="eyebrow m-0">Who are you feeding?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Link
              key={m.key}
              href={m.key === 'solo' ? '/students' : `/students?mode=${m.key}`}
              className="chip"
              data-active={m.key === mode.key}
            >
              {m.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 max-w-[52ch] text-[0.9375rem] text-slate">{mode.blurb}</p>

        {picks.length === 0 ? (
          <p className="mt-6 max-w-[46ch] text-slate">
            Nothing fits this mode in the catalog yet — try another, or{' '}
            <Link href="/recipes" className="text-flame underline underline-offset-2">
              browse everything
            </Link>
            .
          </p>
        ) : (
          <StudentBudgetBoard
            servingsHint={mode.servingsHint}
            picks={picks.map((r) => ({
              id: r.id,
              slug: String(r.slug),
              title: r.title,
              imageUrl: imageFrom(r.heroImage, 'card')?.url ?? null,
              cost: r.costPerServing ?? null,
              minutes: r.totalMinutes ?? null,
              servings: r.servings,
            }))}
          />
        )}
      </section>

      {/* Tonight, not theory. */}
      <section className="mt-14 border-t-2 border-ink pt-6">
        <h2 className="text-[1.5rem]">Tonight, not theory</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Link key={s.label} href={s.href} className="ticket-card block p-5 no-underline">
              <span className="block font-mono text-[0.9375rem] font-semibold text-ink">
                {s.label}
              </span>
              <span className="eyebrow mt-1 block">{s.note}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Leftovers that don't feel sad. */}
      <section className="mt-14 border-t-2 border-ink pt-6">
        <h2 className="text-[1.5rem]">Leftovers that don’t feel sad</h2>
        <p className="mt-2 max-w-[52ch] text-[0.9375rem] text-slate">
          Batch cooking works when the second meal is intentional, not a repeat.
        </p>
        <div className="mt-5 grid gap-x-16 gap-y-6 md:grid-cols-3">
          {LEFTOVER_CHAINS.map((chain, i) => (
            <div key={chain.first} className="border-t border-rule pt-4">
              <div className="leader">
                <span className="font-mono text-[0.875rem] font-semibold">{chain.first}</span>
                <span className="leader__dots" aria-hidden="true" />
                <span className="datum text-flame">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">{chain.then}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
