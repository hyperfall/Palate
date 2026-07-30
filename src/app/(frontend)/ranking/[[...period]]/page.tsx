import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PeriodPicker } from '@/components/PeriodPicker'
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

/** Five stars, filled to the rounded average — read-only, in board colours. */
function Stars({ value }: { value: number }) {
  const filled = Math.round(value)
  return (
    <span aria-hidden="true" className="tracking-[0.1em]">
      <span className="text-flame">{'★'.repeat(filled)}</span>
      <span className="text-rule">{'★'.repeat(5 - filled)}</span>
    </span>
  )
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

      {/* One control band: zoom on the left, time travel on the right. Three
          separate rows drifting across the full shell read as clutter; a
          single ruled band reads as the board's controls. */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-rule py-3">
        <nav aria-label="Ranking period" className="flex flex-wrap gap-2">
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
        {period.grain !== 'all' && (
          <div className="flex items-center gap-2">
            {older && (
              <Link
                href={`/ranking/${older.slug}`}
                aria-label={`Earlier: ${older.label}`}
                className="chip no-underline"
              >
                ←
              </Link>
            )}
            {/* The label is the control: reading the date and changing it are
                the same gesture. */}
            <PeriodPicker
              grain={period.grain}
              anchorIso={period.start ? period.start.toISOString().slice(0, 10) : ''}
              label={period.label}
            />
            {newer && !isFuture(newer, now) ? (
              <Link
                href={`/ranking/${newer.slug}`}
                aria-label={`Later: ${newer.label}`}
                className="chip no-underline"
              >
                →
              </Link>
            ) : (
              // The future is not a place with votes in it.
              <span aria-hidden="true" className="chip pointer-events-none opacity-30">
                →
              </span>
            )}
          </div>
        )}
      </div>

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
          {/* First place: rank numeral, the card, and a tally that fills its
              column. The old layout printed the card's own title again beside
              it and left the right half of the page empty — announcing nothing
              with most of the space. */}
          <section className="mt-10 grid gap-x-10 gap-y-6 lg:grid-cols-[auto_minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
            <div className="flex items-baseline gap-4 lg:block">
              <p
                aria-hidden="true"
                className="m-0 font-display text-[clamp(4rem,10vw,7.5rem)] leading-[0.8] text-flame"
              >
                1
              </p>
              <p className="eyebrow m-0 lg:mt-3">
                Most voted
                {period.grain !== 'all' && (
                  <>
                    <br className="max-lg:hidden" /> {period.label}
                  </>
                )}
              </p>
            </div>

            <RecipeCard recipe={winner.recipe} featured />

            {/* The tally: the numbers a leaderboard owes its winner, in the
                site's dotted-leader ledger voice. */}
            <dl className="m-0 grid content-start gap-2.5 border-t-2 border-ink pt-4 lg:max-w-[22rem]">
              <div className="leader">
                <dt className="eyebrow">Votes</dt>
                <span className="leader__dots" aria-hidden="true" />
                <dd className="datum m-0">{winner.votes}</dd>
              </div>
              <div className="leader">
                <dt className="eyebrow">Average</dt>
                <span className="leader__dots" aria-hidden="true" />
                <dd className="datum m-0">
                  <Stars value={winner.average} /> {winner.average.toFixed(1)}
                </dd>
              </div>
              {typeof winner.recipe.cuisine === 'object' && winner.recipe.cuisine && (
                <div className="leader">
                  <dt className="eyebrow">Kitchen</dt>
                  <span className="leader__dots" aria-hidden="true" />
                  <dd className="datum m-0">{winner.recipe.cuisine.name}</dd>
                </div>
              )}
              {rest[0] && (
                <div className="leader">
                  <dt className="eyebrow">Lead over Nº2</dt>
                  <span className="leader__dots" aria-hidden="true" />
                  <dd className="datum m-0">
                    {winner.votes - rest[0].votes === 0
                      ? 'tied on votes'
                      : `${winner.votes - rest[0].votes} ${winner.votes - rest[0].votes === 1 ? 'vote' : 'votes'}`}
                  </dd>
                </div>
              )}
              <Link href={`/recipes/${winner.recipe.slug}`} className="btn-primary mt-3 w-fit">
                Cook it →
              </Link>
            </dl>
          </section>

          {rest.length > 0 && (
            <section className="mt-14">
              <h2 className="eyebrow m-0">The rest of the field</h2>
              {/* Two ledger columns at xl: eighteen single-file rows was a
                  scroll, not a board. */}
              <ol className="m-0 mt-4 grid list-none gap-x-12 gap-y-0 p-0 xl:grid-cols-2">
                {rest.map((entry, i) => (
                  <li key={entry.recipe.id} className="border-b border-rule">
                    <Link
                      href={`/recipes/${entry.recipe.slug}`}
                      className="group flex items-baseline gap-4 py-3 no-underline"
                    >
                      <span className="w-8 shrink-0 font-display text-[1.25rem] leading-none text-slate/60 tabular-nums group-hover:text-flame">
                        {String(i + 2).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[1.0625rem] text-ink group-hover:text-flame">
                        {entry.recipe.title}
                      </span>
                      <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums text-slate">
                        {entry.votes} {entry.votes === 1 ? 'vote' : 'votes'} ·{' '}
                        {entry.average.toFixed(1)}★
                      </span>
                    </Link>
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
