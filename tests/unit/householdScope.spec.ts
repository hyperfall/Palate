import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { HOUSEHOLD_SCOPED } from '@/app/(frontend)/household/leave/route'

/**
 * Leaving a household has to release every row the leaver owns.
 *
 * A table joins the household pattern by declaring a nullable `household_id`,
 * taking the `set_row_household` trigger, and using the "your rows or your
 * household's" policy. From that moment, a member who leaves must have their
 * rows released or the people they left keep reading them — through the normal
 * product UI, with nothing forged, indefinitely.
 *
 * That is not hypothetical. `meal_plan` and `pantry` were released and the two
 * tables added to the pattern later — `ingredient_prices` and `costings` — were
 * not, so a departed member's grocery prices and named costings stayed visible
 * to their former household.
 *
 * The schema is the source of truth here, not this list. If they disagree, the
 * route is wrong.
 */

const SCHEMA = readFileSync(join(process.cwd(), 'supabase', 'schema.sql'), 'utf8')

/** Tables that declare a household_id column, read straight from the schema. */
function householdScopedTables(): string[] {
  const found = new Set<string>()

  // `alter table public.x add column if not exists household_id ...`
  for (const m of SCHEMA.matchAll(
    /alter\s+table\s+public\.(\w+)\s+add\s+column[^;]*?household_id/gis,
  )) {
    found.add(m[1])
  }

  // `create table ... public.x ( ... household_id ... )`
  for (const m of SCHEMA.matchAll(/create\s+table[^;]*?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    if (/^\s*household_id\s/m.test(m[2])) found.add(m[1])
  }

  return [...found].sort()
}

describe('leaving a household', () => {
  it('finds the household-scoped tables in the schema', () => {
    // If this ever returns nothing the parser has drifted and every assertion
    // below would pass vacuously.
    expect(householdScopedTables().length).toBeGreaterThan(2)
  })

  /**
   * Two tables carry household_id and are deliberately not "released", each for
   * its own reason. Listed rather than filtered out silently, so a future
   * reader can check the reasoning instead of trusting the omission.
   */
  const HANDLED_ANOTHER_WAY: Record<string, string> = {
    // The household's shared tick-list, not the leaver's own data. Deleted.
    shopping_checks: 'deleted outright on leave',
    // The membership itself. Deleting the row IS the departure; there is no
    // leftover to release, and nulling its household_id would orphan it.
    household_members: 'the membership row is deleted, which is the departure',
  }

  it('releases every table that carries a household_id', () => {
    const released = new Set<string>([...HOUSEHOLD_SCOPED, ...Object.keys(HANDLED_ANOTHER_WAY)])
    const missed = householdScopedTables().filter((t) => !released.has(t))

    expect(missed).toEqual([])
  })

  it('does not name a table that no longer exists', () => {
    const inSchema = new Set(householdScopedTables())
    const stale = HOUSEHOLD_SCOPED.filter((t) => !inSchema.has(t))
    expect(stale).toEqual([])
  })
})
