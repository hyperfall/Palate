import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../payload.config'

/**
 * Find recipes whose facts contradict themselves.
 *
 * A subagent cooking Birria found the header promising "1 h 15 min" while step
 * four says "transfer to the oven for 3 hrs". Someone starting that after work
 * eats at midnight — and no test could have caught it, because the code was
 * working perfectly and only the content was wrong.
 *
 * These are the checks a human reviewer would make and will eventually forget
 * to, so they belong in a script that runs before publishing:
 *
 *   npm run audit:recipes
 */
const payload = await getPayload({ config })

/** Durations written into prose: "3 hrs", "8-10 mins", "1 hour 30". */
const DURATION = /(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(hours?|hrs?|minutes?|mins?)\b/gi

function statedMinutes(text: string): number {
  // The LONGEST duration in the step, not the sum: "oven for 3 hrs … after
  // 1 hr 30 mins, season" describes one three-hour wait with a checkpoint in
  // it, and adding them reported 4½ hours.
  let longest = 0
  for (const m of text.matchAll(DURATION)) {
    // Top of a range: "8-10 mins" is a 10-minute commitment.
    const value = Number(m[2] ?? m[1])
    const mins = /h/i.test(m[3]) ? value * 60 : value
    if (mins > longest) longest = mins
  }
  return longest
}

const recipes = await payload.find({ collection: 'recipes', limit: 500, depth: 0 })

type Issue = { recipe: string; kind: string; detail: string }
const issues: Issue[] = []

for (const r of recipes.docs) {
  const title = String(r.title)
  const steps = r.steps ?? []
  const ingredients = r.ingredients ?? []
  const total = Number(r.totalMinutes ?? 0)

  // 1. A single step that outlasts the whole advertised recipe.
  let longest = 0
  steps.forEach((s: { text?: string }, i: number) => {
    const mins = statedMinutes(String(s.text ?? ''))
    if (mins > longest) longest = mins
    if (total > 0 && mins > total) {
      issues.push({
        recipe: title,
        kind: 'TIME',
        detail: `step ${i + 1} describes ~${mins} min but the recipe claims ${total} min total`,
      })
    }
  })

  // 2. An ingredient with no amount at all, where every sibling has one.
  // Everything after a section heading ("To serve") is a garnish, where "as
  // much as you like" is the honest amount. The subagent flagged Birria's
  // mozzarella as uniquely missing one; in fact three of its rows are, and all
  // three sit under To serve — so that finding was noise, not a defect.
  const mainList: Array<{ quantity?: string | null; item: string }> = []
  let inGarnish = false
  for (const x of ingredients as Array<{ heading?: boolean | null; quantity?: string | null; item: string }>) {
    if (x.heading) {
      inGarnish = true
      continue
    }
    if (!inGarnish) mainList.push(x)
  }
  const measured = mainList.filter((x) => x.quantity)
  const unmeasured = mainList.filter((x) => !x.quantity)
  if (measured.length > 0 && unmeasured.length > 0) {
    for (const u of unmeasured) {
      issues.push({ recipe: title, kind: 'AMOUNT', detail: `"${u.item}" has no quantity` })
    }
  }

  // 3. A count wildly out of step with the servings — usually a scaled recipe
  //    whose servings never followed.
  const servings = Number(r.servings ?? 0)
  if (servings > 0) {
    for (const ing of ingredients) {
      const qty = Number(ing.quantity)
      if (!Number.isFinite(qty) || ing.unit || ing.heading) continue
      if (qty / servings >= 8) {
        issues.push({
          recipe: title,
          kind: 'PORTION',
          detail: `${qty} × "${ing.item}" for ${servings} servings (${Math.round(qty / servings)} each)`,
        })
      }
    }
  }

  // 4. No cost, so every surface that prints a plate price stays silent for it.
  //
  // This used to claim the recipe was "excluded from /students". It is not, and
  // never was: the student modes filter on time, effort and servings, and no
  // code path anywhere filters on cost. Verified by fetching all five modes —
  // birria appears under ?mode=two and shakshuka in four of the five, both
  // without a price. A check that invents a consequence is worse than no check:
  // it sends whoever reads it chasing a bug that does not exist.
  if (r.costPerServing == null) {
    issues.push({
      recipe: title,
      kind: 'COST',
      detail: 'no costPerServing — cards and the recipe page show no plate price',
    })
  }
}

if (issues.length === 0) {
  console.log(`No contradictions across ${recipes.docs.length} recipes.`)
} else {
  const byKind = new Map<string, Issue[]>()
  for (const i of issues) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i])
  for (const [kind, list] of byKind) {
    console.log(`\n${kind} (${list.length})`)
    for (const i of list) console.log(`  ${i.recipe}: ${i.detail}`)
  }
  console.log(`\n${issues.length} issue(s) across ${recipes.docs.length} recipes.`)
}
process.exit(0)
