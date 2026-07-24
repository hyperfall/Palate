'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { MEAL_LABELS, MEAL_ORDER, normalizeMeal } from '@/lib/mealPlan'
import { supabaseBrowser, WEEKDAYS } from '@/lib/supabase/client'

type BoardEntry = { id: string; day: number; meal: string; slug: string; title: string; image: string | null }

/**
 * The weekly board. Reorganised so the week reads at a glance: planned days
 * carry a flame weekday + dish count, empty days recede into a compact muted
 * row, meals are clearly labelled, and dishes share a consistent thumbnail card.
 * Deletes write to Supabase.
 */
export function MealBoard({ entries }: { entries: BoardEntry[] }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const remove = async (id: string) => {
    if (!supabase) return
    setBusy(id)
    try {
      const { error } = await supabase.from('meal_plan').delete().eq('id', id)
      if (!error) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <ol className="m-0 grid list-none gap-0 p-0">
      {WEEKDAYS.map((label, day) => {
        const dayEntries = entries.filter((e) => e.day === day)
        const meals = MEAL_ORDER.filter((m) => dayEntries.some((e) => normalizeMeal(e.meal) === m))
        const empty = dayEntries.length === 0

        return (
          <li key={label} className={`border-t border-rule ${empty ? 'py-2.5' : 'py-4'} first:border-t-2 first:border-ink`}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={`font-mono text-[0.8125rem] font-semibold tracking-[0.12em] uppercase ${
                  empty ? 'text-slate/50' : 'text-flame'
                }`}
              >
                {label}
              </span>
              {empty ? (
                <span className="font-mono text-[0.6875rem] tracking-[0.1em] text-slate/40 uppercase">Open</span>
              ) : (
                <span className="datum">
                  {dayEntries.length} {dayEntries.length === 1 ? 'dish' : 'dishes'}
                </span>
              )}
            </div>

            {!empty && (
              <div className="mt-3 grid gap-4">
                {meals.map((m) => (
                  <div key={m}>
                    <p className="m-0 font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-slate uppercase">
                      {MEAL_LABELS[m]}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {dayEntries
                        .filter((e) => normalizeMeal(e.meal) === m)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="group flex items-center gap-3 rounded-md border border-rule bg-card p-2 transition-colors hover:border-flame/40"
                          >
                            {e.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail
                              <img src={e.image} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="grid h-11 w-11 shrink-0 place-items-center rounded border border-dashed border-rule bg-wash text-slate/40"
                              >
                                ◵
                              </span>
                            )}
                            <Link
                              href={`/recipes/${e.slug}`}
                              className="min-w-0 flex-1 truncate font-display text-[1.0625rem] leading-tight text-ink no-underline group-hover:text-flame"
                            >
                              {e.title}
                            </Link>
                            <button
                              type="button"
                              disabled={busy === e.id}
                              onClick={() => void remove(e.id)}
                              aria-label={`Remove ${e.title}`}
                              className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-slate transition-colors hover:border-heat hover:text-heat disabled:opacity-50"
                            >
                              ✕
                            </button>
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
  )
}
