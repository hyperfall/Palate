'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { periodFor, startOfWeek, type Grain } from '@/lib/ranking'

/**
 * The board's date picker: a docket you can read a year off.
 *
 * Built rather than borrowed because a stock datepicker would be the one
 * component on the site that isn't in the site's voice — and because a generic
 * one can't do the thing that matters here: mark the days that actually carry
 * votes. A calendar of identical squares makes someone hunt blindly through
 * empty boards; this one shows where the cooking was.
 *
 * Grain-aware. On a day board it picks days; on a week board any day picks its
 * week; on month and year boards it drops the day grid entirely rather than
 * asking for detail the period can't use.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function PeriodPicker({
  grain,
  anchorIso,
  label,
}: {
  grain: Grain
  /** The current period's start, as YYYY-MM-DD. */
  anchorIso: string
  /** The current period's human label, shown on the trigger. */
  label: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [voteDays, setVoteDays] = useState<Record<string, number>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const anchor = useMemo(() => {
    const [y, m, d] = anchorIso.split('-').map(Number)
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  }, [anchorIso])

  // The month (or year) the picker is currently showing, independent of the
  // period being viewed — you can browse May without leaving July's board.
  const [viewYear, setViewYear] = useState(anchor.getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(anchor.getUTCMonth())

  const today = useMemo(() => new Date(), [])
  const todayIso = isoOf(today)
  const showsDays = grain === 'day' || grain === 'week'

  // Vote markers for the year on screen. Fetched per year and kept, so paging
  // back and forth through months doesn't re-ask.
  const fetchedYears = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (!open || fetchedYears.current.has(viewYear)) return
    fetchedYears.current.add(viewYear)
    let cancelled = false
    void fetch(`/ranking/vote-days?year=${viewYear}`)
      .then((r) => r.json())
      .then((d: { days?: Record<string, number> }) => {
        if (!cancelled && d.days) setVoteDays((prev) => ({ ...prev, ...d.days }))
      })
      .catch(() => {
        // No markers is a duller calendar, not a broken one.
      })
    return () => {
      cancelled = true
    }
  }, [open, viewYear])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (slug: string) => {
    setOpen(false)
    router.push(`/ranking/${slug}`)
  }

  /** The Monday-first grid for the month on screen, padded to whole weeks. */
  const grid = useMemo(() => {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1))
    const lead = (first.getUTCDay() + 6) % 7 // Monday = 0
    const count = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
    const cells: Array<Date | null> = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= count; d++) cells.push(new Date(Date.UTC(viewYear, viewMonth, d)))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  const stepMonth = (by: number) => {
    const d = new Date(Date.UTC(viewYear, viewMonth + by, 1))
    setViewYear(d.getUTCFullYear())
    setViewMonth(d.getUTCMonth())
  }

  const selectedWeekStart = grain === 'week' ? isoOf(startOfWeek(anchor)) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded border border-rule bg-transparent px-3 py-1.5 font-display text-[1.125rem] text-ink transition-colors hover:border-ink"
      >
        {label}
        <span aria-hidden="true" className="font-mono text-[0.75rem] text-slate">
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Jump to a date"
          className="absolute top-full left-0 z-50 mt-2 w-[min(20rem,90vw)] rounded-md border border-ink/25 bg-card p-4 shadow-(--shadow-block)"
        >
          {/* Year, always — the coarsest jump and the fastest way across time. */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
              className="chip !min-h-0 !px-2 !py-1"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(String(viewYear))}
              className="font-display text-[1.25rem] text-ink underline-offset-4 hover:text-flame hover:underline"
            >
              {viewYear}
            </button>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= today.getUTCFullYear()}
              aria-label="Next year"
              className="chip !min-h-0 !px-2 !py-1 disabled:opacity-30"
            >
              ›
            </button>
          </div>

          {/* Months: the picker for a month board, and the month switcher for a
              day or week board. Twelve squares beat a dropdown of twelve. */}
          <div className="mt-3 grid grid-cols-4 gap-1">
            {MONTHS.map((m, i) => {
              const future = new Date(Date.UTC(viewYear, i, 1)) > today
              const isView = i === viewMonth
              return (
                <button
                  key={m}
                  type="button"
                  disabled={future}
                  onClick={() => (showsDays ? setViewMonth(i) : go(`${viewYear}-${pad(i + 1)}`))}
                  className={`rounded py-1.5 font-mono text-[0.6875rem] tracking-[0.04em] uppercase transition-colors disabled:opacity-25 ${
                    isView && showsDays
                      ? 'bg-ink text-paper'
                      : 'text-ink hover:bg-wash disabled:hover:bg-transparent'
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              )
            })}
          </div>

          {showsDays && (
            <>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {DAY_INITIALS.map((d, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="py-1 text-center font-mono text-[0.625rem] tracking-[0.08em] text-slate/60 uppercase"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {grid.map((d, i) => {
                  if (!d) return <span key={`pad-${i}`} />
                  const iso = isoOf(d)
                  const votes = voteDays[iso] ?? 0
                  const future = d > today
                  const isToday = iso === todayIso
                  const selected =
                    grain === 'day' ? iso === anchorIso : isoOf(startOfWeek(d)) === selectedWeekStart
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={future}
                      onClick={() => go(grain === 'week' ? periodFor('week', d).slug : iso)}
                      aria-label={`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}${votes ? `, ${votes} ${votes === 1 ? 'vote' : 'votes'}` : ', no votes'}`}
                      aria-current={selected ? 'date' : undefined}
                      className={`relative grid h-8 place-items-center rounded font-mono text-[0.8125rem] tabular-nums transition-colors disabled:opacity-25 ${
                        selected
                          ? 'bg-ink text-paper'
                          : isToday
                            ? 'border border-flame text-ink hover:bg-wash'
                            : 'text-ink hover:bg-wash disabled:hover:bg-transparent'
                      }`}
                    >
                      {d.getUTCDate()}
                      {/* The whole point: a day that carries votes says so. */}
                      {votes > 0 && (
                        <span
                          aria-hidden="true"
                          className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-paper' : 'bg-flame'}`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-rule pt-3">
            {(
              [
                ['day', 'Today'],
                ['week', 'This week'],
                ['month', 'This month'],
                ['all', 'All time'],
              ] as Array<[Grain, string]>
            ).map(([g, text]) => (
              <button
                key={g}
                type="button"
                onClick={() => go(periodFor(g, today).slug)}
                className="chip !min-h-0 !py-1"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
