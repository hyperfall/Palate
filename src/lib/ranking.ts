/**
 * Period maths for the ranking board.
 *
 * Everything here is UTC. Buckets that shift with the reader's timezone would
 * make "recipe of the day" mean different things to two people looking at the
 * same URL, and a shared leaderboard link has to show the same board to
 * everyone. Weeks start Monday, matching the meal planner.
 *
 * Pure and dependency-free so the boundary cases — month lengths, leap days,
 * year rollovers, the ISO week that starts in December — are testable without
 * a database.
 */

export type Grain = 'day' | 'week' | 'month' | 'year' | 'all'

export type Period = {
  grain: Grain
  /** Inclusive start. `null` for all-time. */
  start: Date | null
  /** Exclusive end. `null` for all-time. */
  end: Date | null
  /** The URL segment that reproduces this period, e.g. "2026-07-30". */
  slug: string
  /** Human label for headings, e.g. "30 July 2026". */
  label: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Midnight UTC on the day containing `d`. */
export function startOfDay(d: Date): Date {
  return utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Monday-midnight UTC of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  // getUTCDay: 0 = Sunday. Shift so Monday is 0, then walk back.
  const offset = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - offset * 86_400_000)
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/**
 * Build a period from a grain and an anchor date. The anchor is snapped to its
 * bucket, so any date inside a month yields that whole month.
 */
export function periodFor(grain: Grain, anchor: Date): Period {
  if (grain === 'all') {
    return { grain, start: null, end: null, slug: 'all', label: 'All time' }
  }
  if (grain === 'day') {
    const start = startOfDay(anchor)
    return {
      grain,
      start,
      end: addDays(start, 1),
      slug: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
      label: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
    }
  }
  if (grain === 'week') {
    const start = startOfWeek(anchor)
    const end = addDays(start, 7)
    const last = addDays(start, 6)
    // Week slugs carry the Monday's date: unambiguous, and no ISO-week-number
    // edge cases where week 1 starts in the previous December.
    return {
      grain,
      start,
      end,
      slug: `w${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
      label: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]} – ${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]} ${last.getUTCFullYear()}`,
    }
  }
  if (grain === 'month') {
    const start = utc(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)
    return {
      grain,
      start,
      // Day 1 of the next month: JS normalises month 12 into the next year, so
      // December needs no special case.
      end: utc(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      slug: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`,
      label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
    }
  }
  const start = utc(anchor.getUTCFullYear(), 0, 1)
  return {
    grain: 'year',
    start,
    end: utc(start.getUTCFullYear() + 1, 0, 1),
    slug: String(start.getUTCFullYear()),
    label: String(start.getUTCFullYear()),
  }
}

/**
 * Did Date.UTC keep the calendar date we asked for, or normalise it away?
 *
 * Month is 1-based here to match the URL segment it validates.
 */
function sameDate(d: Date, year: number, month: number, day: number): boolean {
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

/**
 * Read a URL segment back into a period. Returns null for anything
 * unrecognisable, so a hand-typed URL 404s rather than silently showing today.
 */
export function parsePeriod(slug: string | undefined, now: Date): Period | null {
  if (!slug || slug === 'all') return periodFor('all', now)

  const week = /^w(\d{4})-(\d{2})-(\d{2})$/.exec(slug)
  if (week) {
    const d = utc(+week[1], +week[2] - 1, +week[3])
    // Same rejection as the day branch below. The Number.isNaN check that used
    // to stand here was dead: Date.UTC never returns NaN for finite numbers, it
    // rolls them over — so w2026-02-31 quietly served the 2 March board, and
    // w2026-13-10 served a board in January 2027, each under a URL claiming
    // something else. A leaderboard link has to show what it says or 404.
    if (!sameDate(d, +week[1], +week[2], +week[3])) return null
    return periodFor('week', d)
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slug)
  if (day) {
    const d = utc(+day[1], +day[2] - 1, +day[3])
    // Reject impossible dates (2026-02-31) rather than let JS roll them over.
    if (!sameDate(d, +day[1], +day[2], +day[3])) return null
    return periodFor('day', d)
  }
  const month = /^(\d{4})-(\d{2})$/.exec(slug)
  if (month) {
    const m = +month[2]
    if (m < 1 || m > 12) return null
    return periodFor('month', utc(+month[1], m - 1, 1))
  }
  const year = /^(\d{4})$/.exec(slug)
  if (year) return periodFor('year', utc(+year[1], 0, 1))

  return null
}

/** The same grain, one bucket earlier or later. All-time has no neighbours. */
export function shiftPeriod(period: Period, direction: -1 | 1): Period | null {
  if (period.grain === 'all' || !period.start) return null
  const s = period.start
  if (period.grain === 'day') return periodFor('day', addDays(s, direction))
  if (period.grain === 'week') return periodFor('week', addDays(s, 7 * direction))
  if (period.grain === 'month') {
    return periodFor('month', utc(s.getUTCFullYear(), s.getUTCMonth() + direction, 1))
  }
  return periodFor('year', utc(s.getUTCFullYear() + direction, 0, 1))
}

/** Is this period entirely in the future? Nothing can have been voted in it. */
export function isFuture(period: Period, now: Date): boolean {
  return period.start !== null && period.start.getTime() > now.getTime()
}
