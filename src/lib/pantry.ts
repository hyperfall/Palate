import type { SubRow } from './substitutions'

/**
 * "What can I make from what I have" scoring. Given a recipe's canonical
 * ingredients and the cook's pantry, compute what's missing — treating common
 * staples as always on hand, and counting a required ingredient as covered when
 * the cook holds a curated substitute for it. Pure; no I/O.
 */
export const STAPLES = new Set<string>([
  'salt', 'black pepper', 'pepper', 'water', 'olive oil', 'oil', 'butter',
])

export type RequiredIngredient = { id: number; name: string; substitutions?: SubRow[] | null }
export type Have = { id: number; name: string }

export type Scored<R> = {
  recipe: R
  missing: string[]
  viaSub: Array<{ item: string; sub: string }>
  requiredCount: number
  coveredCount: number
  usedCount: number
}
export type Bands<R> = { cookNow: Scored<R>[]; almost: Scored<R>[]; gettingThere: Scored<R>[] }

/** A curated sub is usable when the cook holds the sub's resolved ingredient (by id) or its label (by name). */
function subYouHold(subs: SubRow[] | null | undefined, haveIds: Set<number>, haveNames: Set<string>): string | null {
  for (const row of subs ?? []) {
    const subObj = row.sub && typeof row.sub === 'object' ? row.sub : null
    const subId = subObj && typeof (subObj as { id?: number }).id === 'number' ? (subObj as { id: number }).id : null
    const label = (subObj?.name ?? row.subText ?? '').trim()
    if ((subId !== null && haveIds.has(subId)) || (label && haveNames.has(label.toLowerCase()))) {
      return label || 'a substitute'
    }
  }
  return null
}

export function scoreRecipe<R>(recipe: R, required: RequiredIngredient[], have: Have[]): Scored<R> {
  const haveIds = new Set(have.map((h) => h.id))
  const haveNames = new Set(have.map((h) => h.name.toLowerCase()))

  // Dedupe required by id and drop staples.
  const seen = new Set<number>()
  const real = required.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return !STAPLES.has(r.name.toLowerCase())
  })

  const missing: string[] = []
  const viaSub: Array<{ item: string; sub: string }> = []
  let usedCount = 0
  for (const r of real) {
    if (haveIds.has(r.id)) {
      usedCount++
      continue
    }
    const sub = subYouHold(r.substitutions, haveIds, haveNames)
    if (sub) {
      viaSub.push({ item: r.name, sub })
      usedCount++ // the substitute is one of the cook's ingredients
      continue
    }
    missing.push(r.name)
  }

  return {
    recipe,
    missing,
    viaSub,
    requiredCount: real.length,
    coveredCount: real.length - missing.length,
    usedCount,
  }
}

export function bandRecipes<R>(scored: Scored<R>[]): Bands<R> {
  const ratio = (s: Scored<R>) => (s.requiredCount ? s.coveredCount / s.requiredCount : 0)
  const shown = scored
    .filter((s) => s.usedCount >= 1) // must use at least one of the cook's ingredients
    .filter((s) => s.missing.length === 0 || (s.usedCount >= 2 && s.missing.length <= 5))
    .sort((a, b) => a.missing.length - b.missing.length || ratio(b) - ratio(a))

  return {
    cookNow: shown.filter((s) => s.missing.length === 0),
    almost: shown.filter((s) => s.missing.length >= 1 && s.missing.length <= 2),
    gettingThere: shown.filter((s) => s.missing.length >= 3 && s.missing.length <= 5),
  }
}
