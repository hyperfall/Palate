// src/lib/ingredients/match.ts
import { normalizeItem } from './normalize'

export type Candidate = { id: number; name: string; aliases: string[] }

/** Sørensen–Dice over character bigrams — 1.0 identical, 0 disjoint. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = (s: string) => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }
  const A = bigrams(a)
  const B = bigrams(b)
  let overlap = 0
  for (const [g, count] of A) overlap += Math.min(count, B.get(g) ?? 0)
  return (2 * overlap) / (a.length - 1 + (b.length - 1))
}

const FUZZY_THRESHOLD = 0.82

export function matchIngredient(
  normalized: string,
  candidates: Candidate[],
): { id: number; confidence: 'exact' | 'fuzzy' } | null {
  if (!normalized) return null
  // Exact on normalized name or any normalized alias.
  for (const c of candidates) {
    if (normalizeItem(c.name) === normalized) return { id: c.id, confidence: 'exact' }
    if (c.aliases.some((a) => normalizeItem(a) === normalized)) {
      return { id: c.id, confidence: 'exact' }
    }
  }
  // Fuzzy — only against the canonical name, above a conservative threshold.
  let best: { id: number; score: number } | null = null
  for (const c of candidates) {
    const score = diceCoefficient(normalized, normalizeItem(c.name))
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { id: c.id, score }
    }
  }
  return best ? { id: best.id, confidence: 'fuzzy' } : null
}
