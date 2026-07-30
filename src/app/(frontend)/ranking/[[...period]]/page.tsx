import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RecipeCard } from '@/components/RecipeCard'
import { findRankedRecipes } from '@/lib/queries'
import { isFuture, parsePeriod, periodFor, shiftPeriod, type Grain, type Period } from '@/lib/ranking'
import { absoluteUrl } from '@/lib/site'

// Short window: a board that lags an hour behind the votes it reports reads as
// broken to the person who just voted.
export const revalidate = 300

type Props = { params: Promise<{ period?: string[] }> }

const GRAINS: Array<{ grain: Grain; label: string }> = [
  { grain: 'day', label: 'Today' },
  { grain: 'week', label: 'This week' },
  { grain: 'month', label: 'This month' },
  { grain: 'year', label: 'This year' },
  { grain: 'all', label: 'All time' },
]

async function resolve(params: Props['params']): Promise<Period> {
  const { period } = await params
  const slug = period?.[0]
  const found = parsePeriod(slug, new Date())
  // A URL that means nothing 404s rather than quietly showing today — a shared
  // leaderboard link must show what it says or nothing.
  if (!found) notFound()
  return found
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const period = await resolve(params)
  const title = period.grain === 'all' ? 'The board, all time' : `The board — ${period.label}`
  return {
    title,
    description: `The most voted recipes on Palate${period.grain === 'all' ? '' : ` for ${period.label}`}, ranked by how many people scored them.`,
    alternates: { canonical: absoluteUrl(`/ranking/${period.slug}`) },
  }
}

export default async function RankingPage({ params }: Props) {
  const period = await resolve(params)
  const now = new Date()
  const ranked = isFuture(period, now) ? [] : await findRankedRecipes(period.start, period.end, 20)

  const older = shiftPeriod(period, -1)
  const newer = shiftPeriod(period, 1)
  const [winner, ...rest] = ranked

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[58ch]">
        <p className="eyebrow m-0">The board</p>
        <h1 className="mt-1 text-[clamp(1.75rem,4.5vw,3rem)] leading-[1.05]">
          What everyone actually cooked well.
        </h1>
        <p className="mt-3 text-lg text-slate max-sm:hidden">
          Ranked by how many people scored a dish, not by how high one person scored it.
        </p>
      </header>

      {/* Grain switch. Each links to the CURRENT bucket of that grain, so
          switching from a March day to "this month" lands on this month rather
          than March — a period switch is "show me now at this zoom". */}
      <nav aria-label="Ranking period" className="mt-8 flex flex-wrap gap-2">
        {GRAINS.map(({ grain, label }) => {
          const target = periodFor(grain, now)
          return (
            <Link
              key={grain}
              href={`/ranking/${target.slug}`}
              aria-current={period.grain === grain ? 'page' : undefined}
              className="chip no-underline"
              data-active={period.grain === grain}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Step through time at the current grain. */}
      {period.grain !== 'all' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-rule py-3">
          {older ? (
            <Link href={`/ranking/${older.slug}`} className="chip no-underline">
              ← {older.label}
            </Link>
          ) : (
            <span />
          )}
          <p className="m-0 font-display text-[1.125rem] text-ink">{period.label}</p>
          {newer && !isFuture(newer, now) ? (
            <Link href={`/ranking/${newer.slug}`} className="chip no-underline">
              {newer.label} →
            </Link>
          ) : (
            // The future is not a place with votes in it.
            <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate/50 uppercase">
              nothing after this yet
            </span>
          )}
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="mt-10 max-w-[52ch]">
          <p className="m-0 font-display text-[1.5rem] text-ink">
            {isFuture(period, now) ? 'Not yet.' : 'No votes in this one.'}
          </p>
          <p className="mt-2 text-slate">
            {isFuture(period, now)
              ? 'This board fills in as people cook and score.'
              : 'Nobody scored a recipe in this period. Cook something and be the first — a single vote puts a dish on the board.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/ranking/all" className="btn-primary">
              See the all-time board →
            </Link>
            <Link
              href="/recipes"
              className="font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
            >
              Browse the board
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* The winner gets the space. A leaderboard where first place looks
              like fourth place isn't announcing anything. */}
          <section className="mt-10">
            <p className="eyebrow m-0 text-flame">
              {period.grain === 'all' ? 'Most voted, all time' : `Most voted · ${period.label}`}
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-center">
              <RecipeCard recipe={winner.recipe} featured />
              <div>
                <p className="m-0 font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-tight text-ink">
                  {winner.recipe.title}
                </p>
                <p className="mt-3 font-mono text-[0.875rem] text-slate">
                  <span className="text-ink">{winner.votes}</span>{' '}
                  {winner.votes === 1 ? 'vote' : 'votes'} · averaging{' '}
                  <span className="text-ink">{winner.average.toFixed(1)}</span> out of 5
                </p>
              </div>
            </div>
          </section>

          {rest.length > 0 && (
            <section className="mt-12">
              <h2 className="eyebrow m-0">The rest of the field</h2>
              <ol className="m-0 mt-4 grid list-none gap-0 p-0">
                {rest.map((entry, i) => (
                  <li
                    key={entry.recipe.id}
                    className="flex items-baseline gap-4 border-b border-rule py-3 last:border-b-0"
                  >
                    <span className="datum w-6 shrink-0 text-slate tabular-nums">{i + 2}</span>
                    <Link
                      href={`/recipes/${entry.recipe.slug}`}
                      className="min-w-0 flex-1 truncate text-[1.0625rem] text-ink no-underline hover:text-flame hover:underline hover:underline-offset-4"
                    >
                      {entry.recipe.title}
                    </Link>
                    <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums text-slate">
                      {entry.votes} {entry.votes === 1 ? 'vote' : 'votes'} · {entry.average.toFixed(1)}★
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <p className="mt-12 max-w-[60ch] border-t border-rule pt-5 text-[0.875rem] text-slate">
        Periods run in UTC so a shared link shows the same board to everyone. Votes count toward the
        period they were cast in, not the day a recipe was published.
      </p>
    </div>
  )
}
