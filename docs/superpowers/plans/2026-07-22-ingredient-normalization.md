# Ingredient Normalization Backbone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every recipe ingredient's freeform `item` to a canonical
`ingredients` record at save time, so substitutions, step-timing, and future
decision/planning features have a stable ingredient key to build on.

**Architecture:** Two pure, unit-tested functions — `normalizeItem` (clean a
freeform string) and `matchIngredient` (resolve it against candidates) — drive a
`beforeChange` hook on the `recipes` collection. Hits link to an existing canonical
`ingredients` doc; misses auto-create a draft flagged `needsReview` for editor
cleanup in /admin. Deterministic; no network/LLM at runtime.

**Tech Stack:** Payload CMS 3 (collections + hooks), TypeScript, Vitest (unit).

## Global Constraints

- Payload version: 3.86.0. Postgres adapter (schema auto-push in dev).
- Pure logic lives under `src/lib/ingredients/`; unit specs under
  `tests/unit/ingredients/` matching `*.spec.ts` (per `vitest.config.mts`).
- Nested Payload writes inside hooks MUST pass `req` (same transaction) — see the
  pattern in `src/collections/Submissions.ts`.
- Idempotent: a save never re-resolves a row that already has an `ingredient` link.
- Run unit tests with: `npm run test:int`.

## File Structure

- Create `src/lib/ingredients/normalize.ts` — `normalizeItem`, `singularize` (pure).
- Create `src/lib/ingredients/match.ts` — `matchIngredient`, `diceCoefficient` (pure).
- Create `tests/unit/ingredients/normalize.spec.ts`, `tests/unit/ingredients/match.spec.ts`.
- Create `src/collections/Ingredients.ts` — the canonical collection.
- Modify `src/payload.config.ts` — register `Ingredients` in the collections array.
- Modify `src/fields/recipeContent.ts` — add `ingredient` + `needsReview` to the
  ingredients array, `uses` to the steps array.
- Modify `src/collections/Recipes.ts` — add the normalization `beforeChange` hook.
- Regenerate `src/payload-types.ts` via `npm run generate:types`.

---

### Task 1: `normalizeItem` (pure)

**Files:**
- Create: `src/lib/ingredients/normalize.ts`
- Test: `tests/unit/ingredients/normalize.spec.ts`

**Interfaces:**
- Produces: `normalizeItem(raw: string): string`, `singularize(word: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ingredients/normalize.spec.ts
import { describe, expect, it } from 'vitest'
import { normalizeItem, singularize } from '@/lib/ingredients/normalize'

describe('singularize', () => {
  it('handles common English plurals', () => {
    expect(singularize('tomatoes')).toBe('tomato')
    expect(singularize('cloves')).toBe('clove')
    expect(singularize('berries')).toBe('berry')
    expect(singularize('glasses')).toBe('glass') // -ses keeps one s
    expect(singularize('molasses')).toBe('molasses') // -ss unchanged
  })
})

describe('normalizeItem', () => {
  it('lowercases, trims, collapses whitespace', () => {
    expect(normalizeItem('  Olive   Oil ')).toBe('olive oil')
  })
  it('drops parentheticals and post-comma qualifiers', () => {
    expect(normalizeItem('butter (unsalted), softened')).toBe('butter')
    expect(normalizeItem('garlic, minced')).toBe('garlic')
  })
  it('strips leading/trailing descriptors', () => {
    expect(normalizeItem('extra-virgin olive oil')).toBe('olive oil')
    expect(normalizeItem('freshly ground black pepper')).toBe('black pepper')
    expect(normalizeItem('2 large ripe tomatoes')).toBe('tomato')
  })
  it('drops trailing "to taste" / "for garnish" / "plus more"', () => {
    expect(normalizeItem('salt to taste')).toBe('salt')
    expect(normalizeItem('cilantro, for garnish')).toBe('cilantro')
    expect(normalizeItem('flour, plus more for dusting')).toBe('flour')
  })
  it('returns empty string for junk', () => {
    expect(normalizeItem('   ')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int`
Expected: FAIL — cannot resolve `@/lib/ingredients/normalize`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/ingredients/normalize.ts
/** Descriptor words stripped from ingredient names before matching. */
const DESCRIPTORS = new Set([
  'fresh', 'freshly', 'dried', 'ground', 'chopped', 'minced', 'sliced', 'diced',
  'grated', 'crushed', 'whole', 'large', 'small', 'medium', 'ripe', 'boneless',
  'skinless', 'raw', 'cooked', 'extra', 'virgin', 'extra-virgin', 'toasted',
  'roasted', 'unsalted', 'salted', 'organic', 'finely', 'roughly', 'thinly',
])

/** Phrases that, once seen, truncate the rest of the string. */
const TAIL_MARKERS = [' to taste', ' for garnish', ' plus more', ' for dusting', ' for serving']

export function singularize(word: string): string {
  if (word.length < 4) return word
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('ss')) return word
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

export function normalizeItem(raw: string): string {
  let s = raw.toLowerCase().trim()
  s = s.replace(/\([^)]*\)/g, ' ') // drop parentheticals
  s = s.split(',')[0] // keep the head, drop ", minced" etc.
  for (const marker of TAIL_MARKERS) {
    const i = s.indexOf(marker)
    if (i >= 0) s = s.slice(0, i)
  }
  s = s.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  // drop a leading quantity token like "2" or "1/2"
  s = s.replace(/^[\d/.\s]+/, '').trim()
  const kept = s.split(' ').filter((w) => w && !DESCRIPTORS.has(w))
  if (kept.length === 0) return ''
  kept[kept.length - 1] = singularize(kept[kept.length - 1])
  return kept.join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int`
Expected: PASS (normalize + singularize specs green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingredients/normalize.ts tests/unit/ingredients/normalize.spec.ts
git commit -m "feat(ingredients): normalizeItem + singularize"
```

---

### Task 2: `matchIngredient` (pure)

**Files:**
- Create: `src/lib/ingredients/match.ts`
- Test: `tests/unit/ingredients/match.spec.ts`

**Interfaces:**
- Consumes: `normalizeItem` from Task 1.
- Produces:
  - `type Candidate = { id: number; name: string; aliases: string[] }`
  - `matchIngredient(normalized: string, candidates: Candidate[]): { id: number; confidence: 'exact' | 'fuzzy' } | null`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ingredients/match.spec.ts
import { describe, expect, it } from 'vitest'
import { matchIngredient, type Candidate } from '@/lib/ingredients/match'

const candidates: Candidate[] = [
  { id: 1, name: 'olive oil', aliases: ['extra-virgin olive oil', 'evoo'] },
  { id: 2, name: 'garlic', aliases: [] },
  { id: 3, name: 'sour cream', aliases: [] },
]

describe('matchIngredient', () => {
  it('matches canonical name exactly', () => {
    expect(matchIngredient('garlic', candidates)).toEqual({ id: 2, confidence: 'exact' })
  })
  it('matches an alias exactly', () => {
    expect(matchIngredient('evoo', candidates)).toEqual({ id: 1, confidence: 'exact' })
  })
  it('fuzzy-matches a close variant', () => {
    expect(matchIngredient('olive oils', candidates)).toEqual({ id: 1, confidence: 'fuzzy' })
  })
  it('does NOT collapse distinct ingredients', () => {
    // "cream" must not fuzzy-merge into "sour cream"
    expect(matchIngredient('cream', candidates)).toBeNull()
  })
  it('returns null when nothing is close', () => {
    expect(matchIngredient('saffron', candidates)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int`
Expected: FAIL — cannot resolve `@/lib/ingredients/match`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:int`
Expected: PASS. (If "cream"/"sour cream" wrongly matches, raise `FUZZY_THRESHOLD`
until that test is null while "olive oils" still matches.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingredients/match.ts tests/unit/ingredients/match.spec.ts
git commit -m "feat(ingredients): matchIngredient with dice fuzzy fallback"
```

---

### Task 3: Canonical `ingredients` collection

**Files:**
- Create: `src/collections/Ingredients.ts`
- Modify: `src/payload.config.ts` (add to the `collections` array + its import)

**Interfaces:**
- Produces: a Payload collection with slug `'ingredients'` and fields
  `name, slug, aliases[], category, countable, densityGPerMl, substitutions[], needsReview`.

- [ ] **Step 1: Write the collection**

```ts
// src/collections/Ingredients.ts
import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

/** The canonical ingredient namespace — the key substitutions, step-timing, and
 *  future decision/planning features build on. Freeform recipe items normalize
 *  into these on save; `needsReview` flags auto-created drafts for editor cleanup. */
export const Ingredients: CollectionConfig = {
  slug: 'ingredients',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'needsReview'], group: 'Content' },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'aliases', type: 'text', hasMany: true, admin: { description: 'Other names that map here.' } },
    {
      name: 'category',
      type: 'select',
      options: ['produce', 'dairy', 'protein', 'oil-fat', 'grain-legume', 'spice-herb', 'condiment', 'bakery', 'other'],
      defaultValue: 'other',
    },
    { name: 'countable', type: 'checkbox', defaultValue: false, admin: { description: 'Discrete items (eggs, cloves).' } },
    { name: 'densityGPerMl', type: 'number', admin: { description: 'Optional — enables weight⇄volume when known.' } },
    {
      name: 'substitutions',
      type: 'array',
      fields: [
        { name: 'sub', type: 'relationship', relationTo: 'ingredients' },
        { name: 'subText', type: 'text', admin: { description: 'Free-text sub when not a catalog ingredient.' } },
        { name: 'kind', type: 'select', required: true, options: ['flavor', 'texture', 'cupboard'] },
        { name: 'ratio', type: 'text', admin: { description: 'e.g. "1:1", "use ¾".' } },
        { name: 'note', type: 'text' },
      ],
    },
    { name: 'needsReview', type: 'checkbox', defaultValue: false, index: true, admin: { position: 'sidebar' } },
  ],
}
```

- [ ] **Step 2: Register it in the config**

In `src/payload.config.ts`, add `import { Ingredients } from './collections/Ingredients'` with the other collection imports, and add `Ingredients` to the `collections: [...]` array (next to `Recipes`).

- [ ] **Step 3: Verify schema + types**

Run: `npm run generate:types`
Expected: completes; `src/payload-types.ts` now contains an `Ingredient` interface.
Then `npx tsc --noEmit` — Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Ingredients.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(ingredients): canonical ingredients collection"
```

---

### Task 4: Recipe fields + normalization hook

**Files:**
- Modify: `src/fields/recipeContent.ts` (ingredients array: add `ingredient` +
  `needsReview`; steps array: add `uses`)
- Modify: `src/collections/Recipes.ts` (add the `beforeChange` normalization hook)
- Modify: `src/payload-types.ts` (regenerate)

**Interfaces:**
- Consumes: `normalizeItem` (Task 1), `matchIngredient` + `Candidate` (Task 2),
  the `ingredients` collection (Task 3).

- [ ] **Step 1: Add the fields**

In `src/fields/recipeContent.ts`, inside the `ingredients` array field's `fields`,
add:
```ts
{ name: 'ingredient', type: 'relationship', relationTo: 'ingredients', admin: { readOnly: true, description: 'Auto-linked canonical ingredient.' } },
{ name: 'needsReview', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
```
Inside the `steps` array field's `fields`, add:
```ts
{ name: 'uses', type: 'relationship', relationTo: 'ingredients', hasMany: true, admin: { description: 'Canonical ingredients this step uses.' } },
```

- [ ] **Step 2: Add the normalization hook to Recipes**

In `src/collections/Recipes.ts`, add a `hooks.beforeChange` entry (create the
`hooks` key if absent):
```ts
import { normalizeItem } from '../lib/ingredients/normalize'
import { matchIngredient, type Candidate } from '../lib/ingredients/match'

// ...inside the collection config:
hooks: {
  beforeChange: [
    async ({ data, req }) => {
      const rows = (data.ingredients ?? []) as Array<{ item?: string; ingredient?: unknown; needsReview?: boolean }>
      if (!rows.some((r) => r.item && !r.ingredient)) return data

      const found = await req.payload.find({ collection: 'ingredients', limit: 1000, depth: 0, req })
      const candidates: Candidate[] = found.docs.map((d) => ({
        id: d.id as number,
        name: d.name as string,
        aliases: (d.aliases as string[] | undefined) ?? [],
      }))

      for (const row of rows) {
        if (row.ingredient || !row.item) continue
        const normalized = normalizeItem(row.item)
        if (!normalized) continue
        const match = matchIngredient(normalized, candidates)
        if (match) {
          row.ingredient = match.id
          continue
        }
        const created = await req.payload.create({
          collection: 'ingredients',
          req,
          data: { name: normalized, needsReview: true } as never,
        })
        candidates.push({ id: created.id as number, name: normalized, aliases: [] })
        row.ingredient = created.id
        row.needsReview = true
      }
      return data
    },
  ],
},
```

- [ ] **Step 3: Regenerate types + typecheck**

Run: `npm run generate:types && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Smoke-test the hook against the running dev DB**

Create `src/import/_normCheck.ts` (temporary):
```ts
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })
const r = (await payload.find({ collection: 'recipes', where: { provenance: { equals: 'authored' } }, limit: 1, depth: 0 })).docs[0]
await payload.update({ collection: 'recipes', id: r.id, data: {} }) // re-save → triggers hook
const after = await payload.findByID({ collection: 'recipes', id: r.id, depth: 0 })
const rows = (after.ingredients ?? []) as Array<{ item?: string; ingredient?: unknown; needsReview?: boolean }>
console.log('[norm] linked:', rows.filter((x) => x.ingredient).length, '/', rows.length,
  '| needsReview:', rows.filter((x) => x.needsReview).length)
process.exit(0)
```
Run: `./node_modules/.bin/cross-env NODE_OPTIONS="--no-deprecation --import=tsx/esm" node src/import/_normCheck.ts`
Expected: every row linked; new canonical ingredients created for first-seen items
(some `needsReview`). Then delete the temp file: `rm src/import/_normCheck.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/fields/recipeContent.ts src/collections/Recipes.ts src/payload-types.ts
git commit -m "feat(ingredients): normalize recipe items on save + step uses field"
```

---

## Follow-on plans (Phase 1 remainder, each its own plan/spec-slice)

1. **Smart substitutions** — surface `ingredients.substitutions[]` as a tappable
   popover in `IngredientsPanel` + cooking mode.
2. **Adaptive servings v2** — units module + humanizing in `IngredientsPanel`.
3. **Per-step ingredient timing** — consume `steps[].uses` in cooking mode.
4. **Enrichment accelerator** — `npm run enrich` (OpenAI, draft/review), key-gated.

## Self-Review

- **Spec coverage:** normalization backbone (Tasks 1–4) fully covers the spec's
  "Normalization at ingest" + the `ingredients` collection + the `steps[].uses`
  field. Substitutions / adaptive servings / step-timing UI / accelerator are the
  named follow-on plans above.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `Candidate` shape and `matchIngredient` return type are
  identical across Tasks 2 and 4; `normalizeItem` signature matches its use in the hook.
