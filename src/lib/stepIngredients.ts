import type { SubRow } from './substitutions'

/**
 * Turns a recipe's steps (with resolved `uses` ingredient objects) into
 * cook-mode steps that know what they need and what to get out early. A
 * prep-ahead nudge fires one step BEFORE an ingredient's first use, from the
 * first-use map — so "take the butter out now" lands while there's still time.
 * Unresolved uses (bare ids, blank names) are dropped, not guessed.
 */
export type StepUse = { name: string; substitutions?: SubRow[] }

export type RawStep = {
  text: string
  timerSeconds?: number | null
  uses?: Array<{ name?: string | null; substitutions?: unknown } | number> | null
}

export type CookStep = {
  text: string
  timerSeconds?: number | null
  uses: StepUse[]
  prepAhead: string[]
}

function resolveUses(raw: RawStep['uses']): StepUse[] {
  if (!raw) return []
  const out: StepUse[] = []
  for (const u of raw) {
    if (typeof u !== 'object' || u === null) continue
    const name = (u.name ?? '').trim()
    if (!name) continue
    out.push({
      name,
      ...(Array.isArray(u.substitutions) ? { substitutions: u.substitutions as SubRow[] } : {}),
    })
  }
  return out
}

export function buildCookSteps(steps: RawStep[]): CookStep[] {
  const resolved = steps.map((s) => ({
    text: s.text,
    timerSeconds: s.timerSeconds ?? null,
    uses: resolveUses(s.uses),
  }))

  // First step index where each ingredient name is used, then bucket each name
  // under the step one before its first use — a single pass, so the final map is
  // a lookup rather than a scan per step.
  const firstUse = new Map<string, number>()
  resolved.forEach((step, i) => {
    for (const use of step.uses) {
      if (!firstUse.has(use.name)) firstUse.set(use.name, i)
    }
  })

  const prepByStep = new Map<number, string[]>()
  for (const [name, firstIndex] of firstUse) {
    if (firstIndex < 1) continue // first used on step 0 — no earlier step to nudge on
    const at = firstIndex - 1
    const bucket = prepByStep.get(at)
    if (bucket) bucket.push(name)
    else prepByStep.set(at, [name])
  }

  return resolved.map((step, i) => ({ ...step, prepAhead: prepByStep.get(i) ?? [] }))
}
