import Link from 'next/link'
import { SITE } from '@/lib/site'
import { MEAL_LABELS, WEEK_DAY_LABELS, weekDishCount, type WeekSnapshot } from '@/lib/mealPlan'

/**
 * The shareable "week card" — a menu-style rendering of a planned week in the
 * kitchen-pass voice, built to look good on screen, in a PNG export, and on
 * paper. Pure presentation: it takes a snapshot and draws it, no data access.
 *
 * Fixed, print-and-share-friendly proportions (portrait, capped width) so the
 * PNG/PDF exports are predictable regardless of the viewport it's rendered in.
 */
export function WeekCard({ week }: { week: WeekSnapshot }) {
  const count = weekDishCount(week)

  return (
    <article
      className="week-card mx-auto flex w-full max-w-[40rem] flex-col overflow-hidden rounded-lg border border-ink/15 bg-card shadow-block"
      style={{ ['--tw-shadow-color' as string]: 'rgb(0 0 0 / 0.12)' }}
    >
      {/* Masthead */}
      <header className="border-b-2 border-ink bg-pan px-8 py-7 text-milk">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow m-0 text-flame">This week&rsquo;s service</p>
          <p className="m-0 font-mono text-[0.75rem] tracking-[0.12em] text-milk/60 uppercase">
            {count} {count === 1 ? 'dish' : 'dishes'}
          </p>
        </div>
        <h1 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.05] text-milk">
          {week.title?.trim() || 'The week ahead'}
        </h1>
        {week.weekOf?.trim() && (
          <p className="datum mt-1 text-milk/75">{week.weekOf}</p>
        )}
      </header>

      {/* The seven days as menu lines */}
      <ol className="m-0 grid list-none gap-0 p-0">
        {week.days.map((slot) => {
          const empty = slot.meals.length === 0
          return (
            <li
              key={slot.day}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-4 border-b border-rule px-8 py-4 last:border-b-0"
            >
              <span
                className={`pt-1 font-mono text-[0.8125rem] font-semibold tracking-[0.12em] uppercase ${
                  empty ? 'text-slate/40' : 'text-flame'
                }`}
              >
                {WEEK_DAY_LABELS[slot.day]}
              </span>

              {empty ? (
                <span className="pt-1 font-mono text-[0.8125rem] tracking-[0.08em] text-slate/40 uppercase">
                  — open —
                </span>
              ) : (
                <div className="grid gap-3.5">
                  {slot.meals.map((meal) => (
                    <div key={meal.meal}>
                      <p className="m-0 font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-slate uppercase">
                        {MEAL_LABELS[meal.meal]}
                      </p>
                      <div className="mt-1.5 grid gap-2.5">
                        {meal.dishes.map((dish, i) => (
                          <div key={`${dish.slug}-${i}`} className="flex items-center gap-3">
                            {dish.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- same-origin; export needs a plain <img>
                              <img
                                src={dish.image}
                                alt=""
                                width={44}
                                height={44}
                                className="h-[44px] w-[44px] shrink-0 rounded-md border border-rule object-cover"
                                style={{ height: 44, width: 44 }}
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-md border border-dashed border-rule bg-wash text-slate/40"
                                style={{ height: 44, width: 44 }}
                              >
                                ◵
                              </span>
                            )}
                            <span className="min-w-0">
                              <Link
                                href={`/recipes/${dish.slug}`}
                                className="font-display text-[1.1875rem] leading-tight text-ink no-underline hover:text-flame hover:underline hover:underline-offset-4"
                              >
                                {dish.title}
                              </Link>
                              {dish.servings != null && (
                                <span className="ml-2 font-mono text-[0.625rem] tracking-[0.1em] text-slate uppercase">
                                  serves {dish.servings}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* Foot — the loop home */}
      <footer className="mt-auto flex items-center justify-between gap-4 border-t-2 border-ink bg-wash px-8 py-4">
        <span className="font-display text-[1.375rem] leading-none text-ink">{SITE.name}</span>
        <span className="font-mono text-[0.75rem] tracking-[0.1em] text-slate uppercase">
          Plan your week — cook first
        </span>
      </footer>
    </article>
  )
}
