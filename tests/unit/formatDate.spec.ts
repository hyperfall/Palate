import { describe, expect, it } from 'vitest'

import { formatDate, formatDayMonth, formatMonthYear } from '@/lib/format'

const ISO = '2026-07-04T12:00:00Z'

describe('date formatting', () => {
  it('pins the locale so one date reads the same on every screen', () => {
    // The bug this replaces: one call site passed `undefined` as the locale, so
    // a visitor outside the UK saw "Jul 4, 2026" on a creator page while every
    // other surface said "4 Jul 2026".
    expect(formatDate(ISO)).toBe('4 Jul 2026')
    expect(formatDayMonth(ISO)).toBe('4 Jul')
    expect(formatMonthYear(ISO)).toBe('Jul 2026')
  })

  it('accepts the shapes the call sites actually pass', () => {
    expect(formatDate(new Date(ISO))).toBe('4 Jul 2026')
    expect(formatDate(Date.parse(ISO))).toBe('4 Jul 2026')
  })

  it('renders nothing rather than "Invalid Date" at a reader', () => {
    // These reach the page from Supabase rows and user input; a malformed one
    // must not print the string "Invalid Date" into the UI.
    for (const bad of [null, undefined, '', 'not a date']) {
      expect(formatDate(bad as never)).toBe('')
      expect(formatDayMonth(bad as never)).toBe('')
      expect(formatMonthYear(bad as never)).toBe('')
    }
  })
})
