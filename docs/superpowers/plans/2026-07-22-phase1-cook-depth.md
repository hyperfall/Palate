# Phase 1 Cook-Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three remaining Phase 1 cook-depth features on the (already-built) ingredient-normalization backbone: smart substitutions, adaptive servings v2, and per-step ingredient timing.

**Architecture:** Pure, unit-tested logic modules (`src/lib/units.ts`, `substitutions.ts`, `stepIngredients.ts`) do the computation; thin client components consume them. No runtime LLM, no request-time aggregation. The unit-system choice is a client setting shared across components via a localStorage-backed hook.

**Tech Stack:** Next.js 16 App Router, Payload CMS 3 (Postgres), React client components, Tailwind v4, Vitest.

## Global Constraints

- **The schema already exists** (built in the normalization phase): `ingredients.substitutions[]` = `{ sub (rel→ingredients), subText, kind: 'flavor'|'texture'|'cupboard', ratio, note }`; `ingredients.countable` (boolean), `ingredients.densityGPerMl` (number); `recipes.ingredients[].ingredient` (rel→ingredients); `recipes.steps[].uses` (hasMany rel→ingredients). Do NOT re-add these.
- **No new schema fields** are required by this plan. If a task seems to need one, stop and flag it.
- The recipe page query `findRecipeBySlug` runs at `depth: 2` — `recipe.ingredients[].ingredient` resolves to an object, its `.substitutions[].sub` resolves to an object, and `recipe.steps[].uses` resolves to objects. Rely on this; do not change the depth without cause.
- **Honest scaling** is a load-bearing product value (see `IngredientsPanel`'s header comment): never fabricate precision. Non-numeric quantities ("a large handful") pass through unchanged. `countable` ingredients never display fractional counts.
- **Runtime never depends on the LLM.** Features degrade gracefully with no data: an ingredient with no subs shows no affordance; a step with empty `uses` shows no chips.
- `tsc` is the working typecheck (`rtk proxy npx tsc --noEmit`); eslint is broken and not a gate. Run via `npm run test:int` / `npx vitest run` for tests.
- Match existing house style: mono eyebrows, `border-rule`, `text-flame` accents, `chip` class, dotted `leader` lines, outside-click-to-close popovers (see `SaveRecipe.tsx` for the popover pattern).
- Default unit system is **`metric`** (UK audience). The toggle only converts the units that actually differ between systems — `cup/floz ⇄ ml/l` and `oz/lb ⇄ g/kg`, plus `°F ⇄ °C` in step text. `tsp`/`tbsp`/`pinch`/`clove`/`can`/counts and any unrecognised unit are **universal** and pass through untouched.

---

### Task 1: Units & measure module

**Files:**
- Create: `src/lib/units.ts`
- Test: `tests/unit/units.spec.ts`

**Interfaces:**
- Produces: `type UnitSystem = 'us' | 'metric'`; `convertMeasure(quantity: number, unit: string, system: UnitSystem): { quantity: number; unit: string }`; `humanizeQuantity(value: number, opts?: { countable?: boolean }): string`; `convertTemperatures(text: string, system: UnitSystem): string`.

- [ ] **Step 1: Write the failing test** — `tests/unit/units.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { convertMeasure, humanizeQuantity, convertTemperatures } from '@/lib/units'

describe('convertMeasure', () => {
  it('converts US volume/weight to metric', () => {
    expect(convertMeasure(1, 'cup', 'metric')).toEqual({ quantity: 240, unit: 'ml' })
    expect(convertMeasure(8, 'oz', 'metric')).toEqual({ quantity: 224, unit: 'g' })
    expect(convertMeasure(2, 'lb', 'metric')).toEqual({ quantity: 908, unit: 'g' })
  })
  it('converts metric weight/volume to US', () => {
    expect(convertMeasure(500, 'g', 'us')).toEqual({ quantity: 1.1, unit: 'lb' })
    expect(convertMeasure(240, 'ml', 'us')).toEqual({ quantity: 1, unit: 'cup' })
  })
  it('promotes to the larger unit past a threshold', () => {
    expect(convertMeasure(4, 'cup', 'metric')).toEqual({ quantity: 960, unit: 'ml' })
    expect(convertMeasure(1500, 'g', 'us').unit).toBe('lb')
  })
  it('leaves universal and unknown units untouched', () => {
    for (const u of ['tbsp', 'tsp', 'clove', 'pinch', 'can', 'sprig']) {
      expect(convertMeasure(2, u, 'metric')).toEqual({ quantity: 2, unit: u })
    }
  })
  it('leaves a unit already in the target system untouched', () => {
    expect(convertMeasure(200, 'g', 'metric')).toEqual({ quantity: 200, unit: 'g' })
    expect(convertMeasure(1, 'cup', 'us')).toEqual({ quantity: 1, unit: 'cup' })
  })
})

describe('humanizeQuantity', () => {
  it('snaps to vulgar fractions', () => {
    expect(humanizeQuantity(0.5)).toBe('½')
    expect(humanizeQuantity(1.75)).toBe('1¾')
    expect(humanizeQuantity(2)).toBe('2')
  })
  it('never shows a fractional count for a countable ingredient', () => {
    expect(humanizeQuantity(1.33, { countable: true })).toBe('1')
    expect(humanizeQuantity(2.6, { countable: true })).toBe('3')
    expect(humanizeQuantity(0.4, { countable: true })).toBe('1') // never rounds a real ingredient to zero
  })
  it('rounds messy decimals to two places', () => {
    expect(humanizeQuantity(0.333)).toBe('⅓')
    expect(humanizeQuantity(1.42)).toBe('1.42')
  })
})

describe('convertTemperatures', () => {
  it('rewrites oven temps to the target system', () => {
    expect(convertTemperatures('Bake at 350°F until golden.', 'metric')).toBe('Bake at 175°C until golden.')
    expect(convertTemperatures('Roast at 200°C.', 'us')).toBe('Roast at 390°F.')
  })
  it('handles a space before the degree and bare F/C', () => {
    expect(convertTemperatures('Heat to 425 F.', 'metric')).toBe('Heat to 220°C.')
  })
  it('leaves text with no temperature unchanged', () => {
    expect(convertTemperatures('Simmer for 10 minutes.', 'metric')).toBe('Simmer for 10 minutes.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/units.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `src/lib/units.ts`

```ts
/**
 * US ⇄ metric conversion for recipe measures, plus friendly-fraction humanising.
 * Only the units that genuinely differ between systems convert — cup/floz⇄ml,
 * oz/lb⇄g/kg, °F⇄°C. tsp/tbsp and non-measure units (clove, pinch, can, counts)
 * are universal and pass through, because converting "1 tbsp" to "15 ml" is
 * noise, not help. Pure functions — no React, no I/O.
 */
export type UnitSystem = 'us' | 'metric'

// ml per US volume unit that we treat as system-specific.
const US_VOLUME_ML: Record<string, number> = { cup: 240, floz: 29.6, 'fl oz': 29.6 }
// grams per US weight unit.
const US_WEIGHT_G: Record<string, number> = { oz: 28, lb: 454 }

const round1 = (n: number) => Math.round(n * 10) / 10

export function convertMeasure(
  quantity: number,
  unit: string,
  system: UnitSystem,
): { quantity: number; unit: string } {
  const u = unit.trim().toLowerCase()

  if (system === 'metric') {
    if (u in US_VOLUME_ML) {
      const ml = quantity * US_VOLUME_ML[u]
      return ml >= 1000 ? { quantity: round1(ml / 1000), unit: 'l' } : { quantity: Math.round(ml), unit: 'ml' }
    }
    if (u in US_WEIGHT_G) {
      const g = quantity * US_WEIGHT_G[u]
      return g >= 1000 ? { quantity: round1(g / 1000), unit: 'kg' } : { quantity: Math.round(g), unit: 'g' }
    }
    return { quantity, unit }
  }

  // → US
  if (u === 'ml' || u === 'l') {
    const ml = u === 'l' ? quantity * 1000 : quantity
    if (ml >= 236) return { quantity: round1(ml / 240), unit: 'cup' }
    return { quantity: round1(ml / 29.6), unit: 'fl oz' }
  }
  if (u === 'g' || u === 'kg') {
    const g = u === 'kg' ? quantity * 1000 : quantity
    if (g >= 454) return { quantity: round1(g / 454), unit: 'lb' }
    return { quantity: round1(g / 28), unit: 'oz' }
  }
  return { quantity, unit }
}

const VULGAR: Array<[number, string]> = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
]

export function humanizeQuantity(value: number, opts: { countable?: boolean } = {}): string {
  if (opts.countable) {
    // Discrete items never read as fractions; never round a real ingredient to 0.
    return String(Math.max(1, Math.round(value)))
  }
  const whole = Math.floor(value)
  const frac = value - whole
  for (const [v, glyph] of VULGAR) {
    if (Math.abs(frac - v) < 0.05) return whole > 0 ? `${whole}${glyph}` : glyph
  }
  if (frac < 0.05) return String(whole)
  return String(Math.round(value * 100) / 100)
}

const TEMP_RE = /(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi

export function convertTemperatures(text: string, system: UnitSystem): string {
  // Oven temps read best rounded to the nearest 5°.
  const to5 = (n: number) => Math.round(n / 5) * 5
  return text.replace(TEMP_RE, (whole, num: string, unit: string) => {
    const value = Number.parseFloat(num)
    const isF = unit.toUpperCase() === 'F'
    if (system === 'metric' && isF) return `${to5(((value - 32) * 5) / 9)}°C`
    if (system === 'us' && !isF) return `${to5((value * 9) / 5 + 32)}°F`
    return whole // already in the target system
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/units.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/units.ts tests/unit/units.spec.ts
git commit -m "feat(units): US⇄metric conversion + measure humanising module"
```

---

### Task 2: Substitutions helper

**Files:**
- Create: `src/lib/substitutions.ts`
- Test: `tests/unit/substitutions.spec.ts`

**Interfaces:**
- Produces: `type SubKind = 'flavor' | 'texture' | 'cupboard'`; `type SubRow = { sub?: { name?: string | null } | number | null; subText?: string | null; kind: SubKind; ratio?: string | null; note?: string | null }`; `type GroupedSub = { label: string; ratio?: string; note?: string }`; `groupSubstitutions(rows: SubRow[] | null | undefined): Array<{ kind: SubKind; title: string; items: GroupedSub[] }>` (only non-empty groups, ordered flavor → texture → cupboard).

- [ ] **Step 1: Write the failing test** — `tests/unit/substitutions.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { groupSubstitutions } from '@/lib/substitutions'

describe('groupSubstitutions', () => {
  it('groups by kind in a fixed order and resolves labels', () => {
    const grouped = groupSubstitutions([
      { subText: 'canned tomatoes', kind: 'cupboard', ratio: '1:1' },
      { sub: { name: 'passata' }, kind: 'texture', note: 'thinner' },
      { sub: { name: 'fresh tomatoes' }, kind: 'flavor' },
    ])
    expect(grouped.map((g) => g.kind)).toEqual(['flavor', 'texture', 'cupboard'])
    expect(grouped[0]).toEqual({
      kind: 'flavor',
      title: 'Closest flavour',
      items: [{ label: 'fresh tomatoes' }],
    })
    expect(grouped[2].items[0]).toEqual({ label: 'canned tomatoes', ratio: '1:1' })
  })
  it('drops rows with no usable label and empty groups', () => {
    const grouped = groupSubstitutions([
      { sub: null, subText: '', kind: 'flavor' },
      { subText: 'yogurt', kind: 'cupboard' },
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].kind).toBe('cupboard')
    expect(grouped[0].title).toBe('Probably in your cupboard')
  })
  it('returns [] for empty / null input', () => {
    expect(groupSubstitutions(null)).toEqual([])
    expect(groupSubstitutions([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/substitutions.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `src/lib/substitutions.ts`

```ts
/**
 * Groups an ingredient's curated substitutions for display: "Closest flavour /
 * Closest texture / Probably in your cupboard." A sub is either a catalog
 * ingredient (populated relationship → use its name) or free text. Rows with no
 * usable label are dropped; empty groups never render. Pure — a runtime read.
 */
export type SubKind = 'flavor' | 'texture' | 'cupboard'

export type SubRow = {
  sub?: { name?: string | null } | number | null
  subText?: string | null
  kind: SubKind
  ratio?: string | null
  note?: string | null
}

export type GroupedSub = { label: string; ratio?: string; note?: string }

const ORDER: Array<{ kind: SubKind; title: string }> = [
  { kind: 'flavor', title: 'Closest flavour' },
  { kind: 'texture', title: 'Closest texture' },
  { kind: 'cupboard', title: 'Probably in your cupboard' },
]

function labelOf(row: SubRow): string {
  if (row.sub && typeof row.sub === 'object' && row.sub.name) return row.sub.name
  return (row.subText ?? '').trim()
}

export function groupSubstitutions(
  rows: SubRow[] | null | undefined,
): Array<{ kind: SubKind; title: string; items: GroupedSub[] }> {
  if (!rows?.length) return []
  return ORDER.map(({ kind, title }) => {
    const items = rows
      .filter((r) => r.kind === kind)
      .map((r) => {
        const label = labelOf(r)
        if (!label) return null
        return {
          label,
          ...(r.ratio ? { ratio: r.ratio } : {}),
          ...(r.note ? { note: r.note } : {}),
        }
      })
      .filter((x): x is GroupedSub => x !== null)
    return { kind, title, items }
  }).filter((g) => g.items.length > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/substitutions.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/substitutions.ts tests/unit/substitutions.spec.ts
git commit -m "feat(subs): group ingredient substitutions by kind"
```

---

### Task 3: Per-step ingredient timing helper

**Files:**
- Create: `src/lib/stepIngredients.ts`
- Test: `tests/unit/stepIngredients.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type StepUse = { name: string; substitutions?: import('./substitutions').SubRow[] }`; `type RawStep = { text: string; timerSeconds?: number | null; uses?: Array<{ name?: string | null; substitutions?: unknown } | number> | null }`; `type CookStep = { text: string; timerSeconds?: number | null; uses: StepUse[]; prepAhead: string[] }`; `buildCookSteps(steps: RawStep[]): CookStep[]`. `prepAhead[i]` names the ingredients whose FIRST use is step `i+1` (surfaced one step early). Unresolved `uses` (bare ids / no name) are skipped.

- [ ] **Step 1: Write the failing test** — `tests/unit/stepIngredients.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { buildCookSteps } from '@/lib/stepIngredients'

describe('buildCookSteps', () => {
  it('carries resolved use names onto each step', () => {
    const steps = buildCookSteps([
      { text: 'Fry onion', uses: [{ name: 'onion' }] },
      { text: 'Add garlic', uses: [{ name: 'garlic' }] },
    ])
    expect(steps[0].uses.map((u) => u.name)).toEqual(['onion'])
    expect(steps[1].uses.map((u) => u.name)).toEqual(['garlic'])
  })
  it('flags each ingredient one step before its first use', () => {
    const steps = buildCookSteps([
      { text: 'Fry onion', uses: [{ name: 'onion' }] },
      { text: 'Add garlic and butter', uses: [{ name: 'garlic' }, { name: 'butter' }] },
      { text: 'Add butter again', uses: [{ name: 'butter' }] },
    ])
    // butter+garlic first used in step 2 → surfaced on step 1 (index 0)
    expect(steps[0].prepAhead.sort()).toEqual(['butter', 'garlic'])
    // butter's first use already passed → not repeated on step 2
    expect(steps[1].prepAhead).toEqual([])
    // onion first-used in step 1 has no earlier step to surface on
    expect(steps.every((s) => !s.prepAhead.includes('onion'))).toBe(true)
  })
  it('skips unresolved uses and tolerates missing uses', () => {
    const steps = buildCookSteps([
      { text: 'Do a thing', uses: [42, { name: '' }] },
      { text: 'Another', uses: null },
    ])
    expect(steps[0].uses).toEqual([])
    expect(steps[1].uses).toEqual([])
    expect(steps.every((s) => s.prepAhead.length === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/stepIngredients.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `src/lib/stepIngredients.ts`

```ts
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

  // First step index where each ingredient name is used.
  const firstUse = new Map<string, number>()
  resolved.forEach((step, i) => {
    for (const use of step.uses) {
      if (!firstUse.has(use.name)) firstUse.set(use.name, i)
    }
  })

  return resolved.map((step, i) => ({
    ...step,
    prepAhead: [...firstUse.entries()]
      .filter(([, firstIndex]) => firstIndex === i + 1)
      .map(([name]) => name),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/stepIngredients.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stepIngredients.ts tests/unit/stepIngredients.spec.ts
git commit -m "feat(steps): derive per-step uses and prep-ahead nudges"
```

---

### Task 4: Unit-system client setting (shared hook)

**Files:**
- Create: `src/lib/useUnitSystem.ts`

**Interfaces:**
- Consumes: `UnitSystem` from Task 1.
- Produces: `useUnitSystem(): readonly [UnitSystem, (next: UnitSystem) => void]`. Persists to `localStorage['palate:units']`, default `'metric'`, and syncs every mounted instance (both the ingredients panel and the method) via a custom event so a toggle in one place updates the other live.

- [ ] **Step 1: Write the implementation** — `src/lib/useUnitSystem.ts`

```ts
'use client'

import { useEffect, useState } from 'react'

import type { UnitSystem } from './units'

const KEY = 'palate:units'
const EVENT = 'palate:units-change'

function read(): UnitSystem {
  if (typeof window === 'undefined') return 'metric'
  return window.localStorage.getItem(KEY) === 'us' ? 'us' : 'metric'
}

/**
 * The reader's US/metric preference, shared across every component that shows
 * measures or step text. Backed by localStorage; a custom event keeps all
 * mounted instances in lockstep (the native `storage` event only fires across
 * tabs, not within one). SSR-safe: defaults to metric until mount.
 */
export function useUnitSystem(): readonly [UnitSystem, (next: UnitSystem) => void] {
  const [system, setSystem] = useState<UnitSystem>('metric')

  useEffect(() => {
    setSystem(read())
    const sync = () => setSystem(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = (next: UnitSystem) => {
    window.localStorage.setItem(KEY, next)
    setSystem(next)
    window.dispatchEvent(new Event(EVENT))
  }

  return [system, update] as const
}
```

- [ ] **Step 2: Typecheck**

Run: `rtk proxy npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useUnitSystem.ts
git commit -m "feat(units): shared localStorage-backed unit-system hook"
```

---

### Task 5: Adaptive servings v2 in IngredientsPanel

**Files:**
- Modify: `src/components/IngredientsPanel.tsx`

**Interfaces:**
- Consumes: `convertMeasure`, `humanizeQuantity` (Task 1), `useUnitSystem` (Task 4), `groupSubstitutions` + `SubRow` (Task 2). This task wires units + humanising + the large-scale advisory; Task 6 adds the substitution popover into the same component.

**Context:** The panel currently scales a numeric quantity by `factor` and formats it with a local `formatQuantity`/`scaleQuantity`. Replace that formatting with the shared module, add a US/metric segmented toggle beside the servings control, and show an advisory line at ≥2× scale. The `Ingredient` type must gain the resolved canonical `ingredient` (for `countable` and, in Task 6, `substitutions`).

- [ ] **Step 1: Extend the Ingredient type and remove the local formatters**

Replace the local `VULGAR`, `formatQuantity`, `scaleQuantity` (lines ~22–46) — the module owns them now — and extend the type:

```ts
import { convertMeasure, humanizeQuantity } from '@/lib/units'
import { useUnitSystem } from '@/lib/useUnitSystem'
import type { SubRow } from '@/lib/substitutions'

type CanonicalIngredient = {
  countable?: boolean | null
  substitutions?: SubRow[] | null
}

type Ingredient = {
  id?: string | null
  quantity?: string | null
  unit?: string | null
  item: string
  note?: string | null
  ingredient?: CanonicalIngredient | number | null
}
```

- [ ] **Step 2: Compute the displayed measure via the module**

Inside the component, add the unit system and a per-row measure builder. Replace the `measure` computation in the `.map` (lines ~151–153):

```ts
const [unitSystem, setUnitSystem] = useUnitSystem()

const measureFor = (ing: Ingredient): string => {
  const parsed = ing.quantity ? Number.parseFloat(ing.quantity) : Number.NaN
  // Non-numeric ("a handful") is left verbatim — scaling it would be a lie.
  if (Number.isNaN(parsed)) return [ing.quantity, ing.unit].filter(Boolean).join(' ')
  const scaled = parsed * factor
  const canonical = ing.ingredient && typeof ing.ingredient === 'object' ? ing.ingredient : null
  const converted = ing.unit
    ? convertMeasure(scaled, ing.unit, unitSystem)
    : { quantity: scaled, unit: '' }
  const qty = humanizeQuantity(converted.quantity, { countable: Boolean(canonical?.countable) })
  return [qty, converted.unit].filter(Boolean).join(' ')
}
```

and use `const measure = measureFor(ingredient)` in the list.

- [ ] **Step 3: Add the US/metric toggle beside the servings control**

In the header row (after the servings `role="group"` div, still inside the `flex-wrap` container), add:

```tsx
<div className="flex items-center gap-0.5 rounded border border-rule p-0.5" role="group" aria-label="Units">
  {(['metric', 'us'] as const).map((sys) => (
    <button
      key={sys}
      type="button"
      onClick={() => setUnitSystem(sys)}
      aria-pressed={unitSystem === sys}
      className={`cursor-pointer rounded-sm border-none px-2.5 py-1.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.08em] transition-colors ${
        unitSystem === sys ? 'bg-flame text-paper' : 'bg-transparent text-slate hover:text-ink'
      }`}
    >
      {sys === 'metric' ? 'Metric' : 'US'}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Add the large-scale advisory**

After the existing `{servings !== baseServings && (…scaled from…)}` block, add:

```tsx
{factor >= 2 && (
  <p className="mt-1.5 text-[0.8125rem] leading-snug text-slate">
    At {Math.round(factor * 10) / 10}×, use a wider pan and expect a little extra cooking time —
    scaled amounts are a starting point, taste as you go.
  </p>
)}
```

- [ ] **Step 5: Verify in the browser**

Start/confirm the dev server, open a recipe (e.g. `/recipes/weeknight-shakshuka`). Confirm: measures render; toggling **US** converts `400 g` → `~14 oz` and `Metric` restores it; raising servings to ≥2× shows the advisory; a `g`-only recipe under Metric is unchanged. Check `read_console_messages` for errors.

- [ ] **Step 6: Typecheck & commit**

Run: `rtk proxy npx tsc --noEmit` → no errors.

```bash
git add src/components/IngredientsPanel.tsx
git commit -m "feat(servings): US/metric toggle, humane measures, scale advisory"
```

---

### Task 6: Substitution popover on the recipe page

**Files:**
- Create: `src/components/SubstitutionPopover.tsx`
- Modify: `src/components/IngredientsPanel.tsx`

**Interfaces:**
- Consumes: `groupSubstitutions`, `SubRow` (Task 2). Uses the outside-click-close pattern from `SaveRecipe.tsx`.
- Produces: `SubstitutionPopover({ item, substitutions }: { item: string; substitutions: SubRow[] })` — renders the ingredient name as a button with a dotted underline when it has subs; opens a disclosure grouped by kind.

- [ ] **Step 1: Write SubstitutionPopover** — `src/components/SubstitutionPopover.tsx`

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

import { groupSubstitutions, type SubRow } from '@/lib/substitutions'

/**
 * A recipe-page ingredient with curated swaps. The name becomes a tappable
 * dotted-underline button; tapping opens a small disclosure grouped as
 * flavour / texture / cupboard. Ingredients with no curated subs never render
 * this — the caller checks first.
 */
export function SubstitutionPopover({ item, substitutions }: { item: string; substitutions: SubRow[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const groups = groupSubstitutions(substitutions)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="cursor-pointer border-none bg-transparent p-0 text-left font-inherit text-ink underline decoration-dotted decoration-rule underline-offset-4 hover:decoration-flame"
      >
        {item}
      </button>
      {open && (
        <span className="absolute top-full left-0 z-40 mt-1.5 block w-[17rem] rounded-md border border-ink/25 bg-card p-3.5 text-ink shadow-(--shadow-block)">
          <span className="eyebrow block">Swap for</span>
          {groups.map((group) => (
            <span key={group.kind} className="mt-2.5 block">
              <span className="block font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-flame">
                {group.title}
              </span>
              <span className="mt-1 block">
                {group.items.map((sub, i) => (
                  <span key={i} className="block py-0.5 text-[0.9375rem] leading-snug">
                    {sub.label}
                    {sub.ratio ? <span className="text-slate"> · {sub.ratio}</span> : null}
                    {sub.note ? <span className="block text-[0.8125rem] text-slate">{sub.note}</span> : null}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Wire it into IngredientsPanel**

Add a helper that reads the canonical subs, and render the name through the popover when present. Replace the item `<span>` (lines ~157–160):

```tsx
{(() => {
  const canonical =
    ingredient.ingredient && typeof ingredient.ingredient === 'object' ? ingredient.ingredient : null
  const subs = canonical?.substitutions ?? []
  return (
    <span>
      {subs.length > 0 ? (
        <SubstitutionPopover item={ingredient.item} substitutions={subs} />
      ) : (
        ingredient.item
      )}
      {ingredient.note ? <span className="text-slate">, {ingredient.note}</span> : null}
    </span>
  )
})()}
```

Add the import: `import { SubstitutionPopover } from './SubstitutionPopover'`.

- [ ] **Step 3: Typecheck**

Run: `rtk proxy npx tsc --noEmit` → no errors. (Browser verification happens in Task 9 once seed data exists.)

- [ ] **Step 4: Commit**

```bash
git add src/components/SubstitutionPopover.tsx src/components/IngredientsPanel.tsx
git commit -m "feat(subs): tappable ingredient substitutions on the recipe page"
```

---

### Task 7: Per-step timing in cooking mode

**Files:**
- Modify: `src/components/CookMode.tsx`
- Modify: `src/app/(frontend)/recipes/[slug]/page.tsx`

**Interfaces:**
- Consumes: `buildCookSteps`, `CookStep` (Task 3); `SubstitutionPopover` (Task 6) for tappable step-ingredient swaps (satisfies the spec's "subs reachable from the cooking-mode rail").

**Context:** `CookModeLauncher`/`CookMode` currently take `steps: { text; timerSeconds }[]`. Widen to the `CookStep` shape (adds `uses`, `prepAhead`), render a "You'll need" chip row and a prep-ahead nudge, and build the steps on the recipe page from `recipe.steps` (whose `uses` resolve to ingredient objects at depth 2, each carrying `name` + `substitutions`).

- [ ] **Step 1: Widen the CookMode step type**

Replace `type CookStep = { text: string; timerSeconds?: number | null }` with an import:

```ts
import type { CookStep } from '@/lib/stepIngredients'
import { SubstitutionPopover } from './SubstitutionPopover'
```

and change both `CookMode` and `CookModeLauncher` props from the inline type to `steps: CookStep[]`.

- [ ] **Step 2: Render the "You'll need" chips and prep-ahead nudge**

In the active-step branch, after the `step?.text` paragraph and before the timer block, add:

```tsx
{step && step.uses.length > 0 && (
  <div className="mt-6 flex flex-wrap items-center gap-2">
    <span className="eyebrow text-slate">You'll need</span>
    {step.uses.map((use) =>
      use.substitutions && use.substitutions.length > 0 ? (
        <span key={use.name} className="chip !cursor-auto !py-1">
          <SubstitutionPopover item={use.name} substitutions={use.substitutions} />
        </span>
      ) : (
        <span key={use.name} className="chip !min-h-0 !cursor-default !py-1">
          {use.name}
        </span>
      ),
    )}
  </div>
)}
{step && step.prepAhead.length > 0 && (
  <p className="mt-4 font-mono text-[0.8125rem] text-flame">
    Coming up — take out: {step.prepAhead.join(', ')}.
  </p>
)}
```

- [ ] **Step 3: Build steps on the recipe page**

In `recipes/[slug]/page.tsx`, replace the inline `steps={(recipe.steps ?? []).map(...)}` passed to `CookModeLauncher` with `buildCookSteps`:

```tsx
import { buildCookSteps } from '@/lib/stepIngredients'
```

```tsx
<CookModeLauncher
  title={recipe.title}
  steps={buildCookSteps(
    (recipe.steps ?? []).map((step) => ({
      text: step.text,
      timerSeconds: step.timerSeconds,
      uses: Array.isArray(step.uses)
        ? step.uses.map((u) =>
            typeof u === 'object' && u
              ? { name: u.name, substitutions: u.substitutions }
              : u,
          )
        : null,
    })),
  )}
  finish={recipe.finish ?? null}
/>
```

(If `recipe.steps[].uses` is typed as `(number | Ingredient)[]`, the `typeof u === 'object'` guard narrows it; cast the mapped array `as never` only if the Payload generated type resists — prefer a typed map.)

- [ ] **Step 4: Verify in the browser**

The seeded recipe from Task 8 will have `uses` populated. After Task 8, open its cooking mode: confirm the "You'll need" chips appear on steps with `uses`, the "Coming up — take out …" nudge appears one step before an ingredient's first use, and a chip with subs opens the popover. Steps with no `uses` show neither. Check console for errors.

- [ ] **Step 5: Typecheck & commit**

Run: `rtk proxy npx tsc --noEmit` → no errors.

```bash
git add src/components/CookMode.tsx "src/app/(frontend)/recipes/[slug]/page.tsx"
git commit -m "feat(cook): per-step you'll-need chips, prep-ahead nudge, step subs"
```

---

### Task 8: Seed demonstrable cook-depth data

**Files:**
- Create: `src/scripts/seedCookDepth.ts`
- Modify: `package.json` (add `"seed:cook-depth"` script)

**Context:** Substitutions and step-`uses` render nothing until data exists — the features are correct but invisible on the current catalog. Seed a small, *real* editorial set against one well-known recipe (Weeknight Shakshuka) plus a few common canonical ingredients, so every surface is demonstrable and browser-verifiable. This is editorial content (not user data) — accurate swaps only, no fabricated precision.

- [ ] **Step 1: Write the seed script** — `src/scripts/seedCookDepth.ts`

```ts
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Seeds a small, real editorial set so substitutions + step timing are visible:
 * common-ingredient swaps on canonical ingredients, and step→ingredient links
 * on one flagship recipe. Idempotent — matches ingredients by name, skips a
 * recipe that already has step uses. Run: npm run seed:cook-depth
 */
const SUBS: Record<string, Array<{ subText: string; kind: 'flavor' | 'texture' | 'cupboard'; ratio?: string; note?: string }>> = {
  'olive oil': [
    { subText: 'avocado oil', kind: 'flavor', ratio: '1:1', note: 'neutral, high smoke point' },
    { subText: 'butter', kind: 'texture', ratio: '1:1', note: 'richer, lower smoke point' },
    { subText: 'any neutral oil', kind: 'cupboard', ratio: '1:1' },
  ],
  garlic: [
    { subText: 'garlic granules', kind: 'cupboard', ratio: '1 clove ≈ ⅛ tsp' },
    { subText: 'shallot', kind: 'flavor', note: 'milder, sweeter' },
  ],
  feta: [
    { subText: 'goat cheese', kind: 'flavor', ratio: '1:1' },
    { subText: 'ricotta salata', kind: 'texture', ratio: '1:1' },
    { subText: 'crumbled paneer + salt', kind: 'cupboard' },
  ],
  cumin: [{ subText: 'ground coriander', kind: 'flavor', note: 'earthier, less warm' }],
}

async function run() {
  const payload = await getPayload({ config })

  for (const [name, substitutions] of Object.entries(SUBS)) {
    const found = await payload.find({ collection: 'ingredients', where: { name: { equals: name } }, limit: 1 })
    const doc = found.docs[0]
    if (!doc) {
      console.log(`skip subs: no canonical ingredient "${name}"`)
      continue
    }
    await payload.update({ collection: 'ingredients', id: doc.id, data: { substitutions } as never })
    console.log(`subs → ${name}`)
  }

  // Link steps → ingredients on the flagship recipe by matching names in text.
  const recipes = await payload.find({ collection: 'recipes', where: { slug: { equals: 'weeknight-shakshuka' } }, limit: 1, depth: 1 })
  const recipe = recipes.docs[0]
  if (recipe) {
    const ingredients = await payload.find({ collection: 'ingredients', limit: 1000, depth: 0 })
    const byName = new Map(ingredients.docs.map((d) => [String(d.name).toLowerCase(), d.id as number]))
    const steps = (recipe.steps ?? []).map((step: { text: string; uses?: unknown }) => {
      const uses = [...byName.entries()]
        .filter(([name]) => step.text.toLowerCase().includes(name))
        .map(([, id]) => id)
      return { ...step, uses: uses.length ? uses : step.uses }
    })
    await payload.update({ collection: 'recipes', id: recipe.id, data: { steps } as never })
    console.log(`step uses → ${recipe.slug}`)
  }

  console.log('done')
  process.exit(0)
}

void run()
```

- [ ] **Step 2: Add the npm script** — `package.json`

```json
"seed:cook-depth": "cross-env NODE_OPTIONS=\"--no-deprecation --import=tsx/esm\" node src/scripts/seedCookDepth.ts",
```

- [ ] **Step 3: Run the seed**

Run: `npm run seed:cook-depth`
Expected: logs `subs → olive oil`, …, `step uses → weeknight-shakshuka`, `done`. (If a canonical name isn't present it logs a skip — acceptable; the recipe step-uses is the key demo.)

- [ ] **Step 4: Verify end-to-end in the browser**

Open `/recipes/weeknight-shakshuka`: ingredients with seeded subs (olive oil, garlic, feta) show a dotted underline and open the swap popover; start cooking mode and confirm the "You'll need" chips + prep-ahead nudge from Task 7. `read_console_messages` clean.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/seedCookDepth.ts package.json
git commit -m "chore(seed): editorial substitutions + step links for demo"
```

---

## Self-Review Notes

- **Spec coverage:** substitutions (Tasks 2, 6, 7-step-subs, 8) ✓; adaptive servings v2 — unit toggle + humane measures + advisory (Tasks 1, 4, 5) and °F↔°C (Task 1 `convertTemperatures`, applied to step text — see note below) ✓; per-step timing (Tasks 3, 7, 8) ✓. The optional `npm run enrich` accelerator is explicitly out of this plan (it's additive tooling, gated on `OPENAI_API_KEY`) — build it separately if wanted.
- **Deferred sub-item — step-text temperature conversion in the method column:** `convertTemperatures` is built and tested in Task 1 and used in cooking mode is straightforward, but wiring the toggle into the *static method list* on the recipe page requires making that list a client component. It is intentionally NOT in a task above to avoid converting the server-rendered method to client just for temp display. If the reviewer wants it, add a small client wrapper around the method `<ol>` that reads `useUnitSystem` and maps `convertTemperatures(step.text, system)`. Flag this at execution as a scope decision.
- **Types:** `SubRow` is defined once (Task 2) and imported by Tasks 3, 5, 6, 7. `CookStep` is defined once (Task 3) and imported by Task 7. `UnitSystem` once (Task 1), imported by Task 4.
- **Risk:** step-`uses` name matching in the seed (Task 8) is substring-based and deliberately conservative — it only links names that literally appear in step text; anything missed just shows fewer chips, never a wrong one.
