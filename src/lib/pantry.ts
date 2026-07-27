import { normalizeItem } from './ingredients/normalize'
import type { SubRow } from './substitutions'

/**
 * "What can I make from what I have" scoring. Given a recipe's canonical
 * ingredients and the cook's pantry, compute what's missing — treating common
 * staples as always on hand, and counting a required ingredient as covered when
 * the cook holds a curated substitute for it. Pure; no I/O.
 */
export const STAPLES = new Set<string>([
  'salt', 'sea salt', 'sea salt flake', 'black pepper', 'pepper', 'black peppercorn',
  'water', 'olive oil', 'oil', 'sunflower oil', 'vegetable oil', 'butter',
  'sugar', 'plain flour', 'flour',
])

/**
 * Modifier words that don't change what an ingredient IS — a cook holding
 * "onion" can make a recipe calling for "white onion", and vice versa. Kept
 * deliberately narrow: colour and size only. "spring onion", "coconut milk",
 * and "red wine vinegar" all differ by NON-modifier words and stay distinct.
 */
const SAFE_MODIFIERS = new Set([
  'white', 'red', 'yellow', 'brown', 'golden', 'green',
  'baby', 'large', 'small', 'medium', 'ripe',
])

/** True when two normalized names refer to the same ingredient up to safe
 *  modifiers: same head word, and every differing token is a safe modifier. */
export function namesEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const ta = a.split(' ')
  const tb = b.split(' ')
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false
  const setA = new Set(ta)
  const setB = new Set(tb)
  for (const t of ta) if (!setB.has(t) && !SAFE_MODIFIERS.has(t)) return false
  for (const t of tb) if (!setA.has(t) && !SAFE_MODIFIERS.has(t)) return false
  return true
}

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
    let subId: number | null = null
    let label = ''
    if (typeof row.sub === 'number') {
      subId = row.sub
    } else if (row.sub && typeof row.sub === 'object') {
      const o = row.sub as { id?: number; name?: string | null }
      if (typeof o.id === 'number') subId = o.id
      label = (o.name ?? '').trim()
    }
    if (!label) label = (row.subText ?? '').trim()
    if ((subId !== null && haveIds.has(subId)) || (label && haveNames.has(label.toLowerCase()))) {
      return label || 'a substitute'
    }
  }
  return null
}

export function scoreRecipe<R>(recipe: R, required: RequiredIngredient[], have: Have[]): Scored<R> {
  const haveIds = new Set(have.map((h) => h.id))
  // Names are compared through the same normalizer the ingredient backbone
  // uses — accents folded, plurals singularized, descriptors stripped — so
  // "Bird's eye chillies" in a pantry matches the canonical form.
  const haveNames = new Set(have.map((h) => h.name.toLowerCase()))
  const haveNorms = have.map((h) => normalizeItem(h.name)).filter(Boolean)

  // Dedupe required by id and drop staples (checked raw and normalized, so
  // "sea salt flakes" counts as the staple it is).
  const seen = new Set<number>()
  const real = required.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return !STAPLES.has(r.name.toLowerCase()) && !STAPLES.has(normalizeItem(r.name))
  })

  const missing: string[] = []
  const viaSub: Array<{ item: string; sub: string }> = []
  let usedCount = 0
  for (const r of real) {
    if (haveIds.has(r.id)) {
      usedCount++
      continue
    }
    // Variant coverage: holding "onion" covers a recipe's "white onion" (and
    // the reverse) — same ingredient up to colour/size words.
    const reqNorm = normalizeItem(r.name)
    if (haveNorms.some((h) => namesEquivalent(h, reqNorm))) {
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
    // A near-miss just needs to genuinely use ≥2 of your ingredients; there's no
    // cap on how many it's missing, because real recipes carry 8–12 ingredients
    // and the ranking (fewest-missing first) already surfaces the closest ones.
    .filter((s) => s.missing.length === 0 || s.usedCount >= 2)
    // Overlap first: the more of the cook's own ingredients a recipe uses, the
    // more relevant it is (their mental model — add an ingredient, the dishes
    // that use it rise). Ties break toward fewest-missing, then best coverage.
    .sort(
      (a, b) =>
        b.usedCount - a.usedCount ||
        a.missing.length - b.missing.length ||
        ratio(b) - ratio(a),
    )

  return {
    cookNow: shown.filter((s) => s.missing.length === 0),
    almost: shown.filter((s) => s.missing.length >= 1 && s.missing.length <= 2),
    gettingThere: shown.filter((s) => s.missing.length >= 3),
  }
}
