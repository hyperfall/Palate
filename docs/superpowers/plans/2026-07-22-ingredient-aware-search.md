# Ingredient-Aware Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `/cook-from` — enter the ingredients you have, get "Cook now" recipes first, then near-misses that list exactly what's missing.

**Architecture:** A pure, unit-tested coverage/banding module (`src/lib/pantry.ts`) does the logic; a query (`findRecipesByPantry`) feeds it published recipes with canonical ingredient links; a server page renders bands via `RecipeCard`; a client `PantryFinder` manages chips, autocomplete, and URL/localStorage state.

**Tech Stack:** Next.js 16 App Router, Payload 3 (Postgres), React client components, Tailwind v4, Vitest.

## Global Constraints

- **Reuse the normalization backbone** — canonical `ingredients` (name, slug, aliases, `substitutions[]`), `recipes.ingredients[].ingredient` links. Do NOT add ingredient-matching logic that duplicates `src/lib/ingredients/*`.
- **No new Payload schema.** Pantry staples are a code constant, not a field, in v1.
- `findRecipeBySlug` and the new query run at `depth: 2` so `ingredients[].ingredient` and its `substitutions[].sub` resolve. Rely on it.
- Only **published** recipes are ever returned (the local API overrides access — state `status: 'published'` explicitly, like `buildWhere` does).
- `tsc` is the working typecheck (`rtk proxy npx tsc --noEmit`); eslint is broken. Tests via `npx vitest run`.
- Match house style: kitchen-pass tokens (`border-rule`, `text-flame`, `chip`, `eyebrow`), `RecipeCard` for results, `FilterPanel`'s URL-commit pattern for the client control, `NavSearch`/existing nav for the link.
- **Assumed pantry staples** (never counted as missing), by canonical name: `salt`, `black pepper`, `pepper`, `water`, `olive oil`, `oil`, `butter`.
- **Bands & cutoffs:** Cook now = 0 missing; "One or two away" = 1–2; "Getting there" = 3–5. A recipe shows only if it uses ≥1 of your ingredients, and near-miss bands additionally require using ≥2 and missing ≤5. Rank by missing asc, then match ratio (`covered/required`) desc.

---

### Task 1: Pantry coverage & banding module

**Files:**
- Create: `src/lib/pantry.ts`
- Test: `tests/unit/pantry.spec.ts`

**Interfaces:**
- Produces:
  - `STAPLES: Set<string>`
  - `type SubRow` — reuse `import type { SubRow } from './substitutions'`
  - `type RequiredIngredient = { id: number; name: string; substitutions?: SubRow[] | null }`
  - `type Have = { id: number; name: string }`
  - `type Scored<R> = { recipe: R; missing: string[]; viaSub: Array<{ item: string; sub: string }>; requiredCount: number; coveredCount: number; usedCount: number }`
  - `type Bands<R> = { cookNow: Scored<R>[]; almost: Scored<R>[]; gettingThere: Scored<R>[] }`
  - `scoreRecipe<R>(recipe: R, required: RequiredIngredient[], have: Have[]): Scored<R>`
  - `bandRecipes<R>(scored: Scored<R>[]): Bands<R>`

- [ ] **Step 1: Write the failing test** — `tests/unit/pantry.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { STAPLES, scoreRecipe, bandRecipes } from '@/lib/pantry'

const req = (id: number, name: string, substitutions?: any) => ({ id, name, substitutions })

describe('scoreRecipe', () => {
  it('ignores staples and counts covered vs missing', () => {
    const required = [req(1, 'chicken thigh'), req(2, 'spinach'), req(3, 'salt'), req(4, 'feta')]
    const have = [{ id: 1, name: 'chicken thigh' }, { id: 2, name: 'spinach' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual(['feta']) // salt is a staple, dropped
    expect(s.requiredCount).toBe(3) // chicken, spinach, feta (not salt)
    expect(s.coveredCount).toBe(2)
    expect(s.usedCount).toBe(2)
  })
  it('covers a missing ingredient via a substitute you hold, and notes it', () => {
    const required = [
      req(1, 'chicken thigh'),
      req(5, 'buttermilk', [{ sub: { id: 9, name: 'yogurt' }, kind: 'cupboard' }]),
    ]
    const have = [{ id: 1, name: 'chicken thigh' }, { id: 9, name: 'yogurt' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual([])
    expect(s.viaSub).toEqual([{ item: 'buttermilk', sub: 'yogurt' }])
    expect(s.coveredCount).toBe(2)
  })
  it('matches a free-text substitute by name', () => {
    const required = [req(5, 'buttermilk', [{ subText: 'plain yogurt', kind: 'cupboard' }])]
    const have = [{ id: 9, name: 'plain yogurt' }]
    const s = scoreRecipe('R', required, have)
    expect(s.missing).toEqual([])
    expect(s.viaSub[0].sub).toBe('plain yogurt')
  })
})

describe('bandRecipes', () => {
  const scored = (id: string, missing: string[], used: number, required = missing.length + used) => ({
    recipe: id, missing, viaSub: [], requiredCount: required, coveredCount: required - missing.length, usedCount: used,
  })
  it('bands by missing count and drops near-useless matches', () => {
    const b = bandRecipes([
      scored('now', [], 2),
      scored('one', ['feta'], 3),
      scored('three', ['a', 'b', 'c'], 3),
      scored('single-use-nearmiss', ['x'], 1), // uses <2 of yours -> dropped from near-miss
      scored('too-many', ['a', 'b', 'c', 'd', 'e', 'f'], 3), // missing >5 -> dropped
      scored('uses-none', [], 0), // uses none of yours -> dropped entirely
    ])
    expect(b.cookNow.map((r) => r.recipe)).toEqual(['now'])
    expect(b.almost.map((r) => r.recipe)).toEqual(['one'])
    expect(b.gettingThere.map((r) => r.recipe)).toEqual(['three'])
  })
  it('ranks within the full result by missing asc then match ratio desc', () => {
    // m2-high: required 8, covered 6 -> ratio .75 ; m2-low: required 4, covered 2 -> ratio .5
    const b = bandRecipes([
      scored('m2-high', ['a', 'b'], 6, 8),
      scored('m1', ['a'], 3),
      scored('m2-low', ['a', 'b'], 2, 4),
    ])
    expect(b.almost.map((r) => r.recipe)).toEqual(['m1', 'm2-high', 'm2-low'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/pantry.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `src/lib/pantry.ts`

```ts
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
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run tests/unit/pantry.spec.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/pantry.ts tests/unit/pantry.spec.ts && git commit -m "feat(pantry): ingredient coverage + banding for cook-from"`

---

### Task 2: Query + catalog normalization pass

**Files:**
- Modify: `src/lib/queries.ts`
- Create: `src/scripts/normalizeCatalog.ts`
- Modify: `package.json` (add `normalize:catalog`)

**Interfaces:**
- Consumes: `scoreRecipe`, `bandRecipes`, `RequiredIngredient`, `Have`, `Bands` (Task 1); `Recipe` type.
- Produces: `findRecipesByPantry(have: Have[], opts?: { maxMinutes?: number | null }): Promise<Bands<Recipe>>`.

- [ ] **Step 1** — Add `findRecipesByPantry` to `src/lib/queries.ts`:

```ts
import { scoreRecipe, bandRecipes, type Have, type Bands, type RequiredIngredient } from './pantry'

export async function findRecipesByPantry(
  have: Have[],
  { maxMinutes = null }: { maxMinutes?: number | null } = {},
): Promise<Bands<Recipe>> {
  if (have.length === 0) return { cookNow: [], almost: [], gettingThere: [] }
  const payload = await getPayloadClient()
  const where: Record<string, unknown> = { and: [PUBLISHED] as Record<string, unknown>[] }
  if (maxMinutes) (where.and as Record<string, unknown>[]).push({ totalMinutes: { less_than_equal: maxMinutes } })

  const result = await payload.find({ collection: 'recipes', where: where as never, depth: 2, limit: 500 })

  const scored = result.docs.map((recipe) => {
    const required: RequiredIngredient[] = (recipe.ingredients ?? [])
      .map((row) => (typeof row.ingredient === 'object' && row.ingredient ? row.ingredient : null))
      .filter((ing): ing is NonNullable<typeof ing> => Boolean(ing))
      .map((ing) => ({
        id: ing.id as number,
        name: String(ing.name),
        substitutions: (ing as { substitutions?: unknown }).substitutions as never,
      }))
    return scoreRecipe(recipe, required, have)
  })

  return bandRecipes(scored)
}
```

- [ ] **Step 2** — Create `src/scripts/normalizeCatalog.ts` — re-saves every recipe so the existing catalog gets canonical ingredient links (the beforeChange normalization hook runs on save):

```ts
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * One-time: re-save every recipe so the ingredient-normalization hook links
 * each ingredient row to a canonical ingredient. Ingredient-aware search can
 * only match linked rows. Idempotent — already-linked rows are left alone by the
 * hook. Run: npm run normalize:catalog
 */
async function run() {
  const payload = await getPayload({ config })
  const recipes = await payload.find({ collection: 'recipes', limit: 1000, depth: 0 })
  for (const r of recipes.docs) {
    await payload.update({ collection: 'recipes', id: r.id, data: {} as never })
    console.log(`normalized ${r.slug}`)
  }
  console.log(`done — ${recipes.docs.length} recipes`)
  process.exit(0)
}
void run()
```

- [ ] **Step 3** — Add to `package.json` scripts:
```json
"normalize:catalog": "cross-env NODE_OPTIONS=\"--no-deprecation --import=tsx/esm\" node src/scripts/normalizeCatalog.ts",
```

- [ ] **Step 4** — Run it: `npm run normalize:catalog` → logs each recipe, `done — N recipes`. Then `rtk proxy npx tsc --noEmit` → clean.
- [ ] **Step 5: Commit** — `git add src/lib/queries.ts src/scripts/normalizeCatalog.ts package.json && git commit -m "feat(pantry): findRecipesByPantry query + catalog normalization pass"`

---

### Task 3: Ingredient autocomplete route

**Files:**
- Create: `src/app/(frontend)/cook-from/suggest/route.ts`

**Interfaces:**
- Produces: `GET /cook-from/suggest?q=<text>` → `{ suggestions: Array<{ slug: string; name: string }> }` (≤8), canonical ingredients whose name or an alias contains `q` (case-insensitive). Empty/short `q` → empty list.

- [ ] **Step 1** — Create the route:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'ingredients',
    where: { or: [{ name: { like: q } }, { aliases: { like: q } }] },
    limit: 8,
    depth: 0,
    sort: 'name',
  })
  const suggestions = result.docs.map((d) => ({ slug: String(d.slug), name: String(d.name) }))
  return NextResponse.json({ suggestions })
}
```

- [ ] **Step 2** — Verify: with the dev server up, `curl 'http://localhost:3000/cook-from/suggest?q=oli'` returns olive oil. `tsc` clean.
- [ ] **Step 3: Commit** — `git add "src/app/(frontend)/cook-from/suggest/route.ts" && git commit -m "feat(pantry): ingredient autocomplete route"`

---

### Task 4: The /cook-from page, PantryFinder, and nav link

**Files:**
- Create: `src/app/(frontend)/cook-from/page.tsx`
- Create: `src/components/PantryFinder.tsx`
- Modify: the nav component (find the one rendering the "Tonight"/"Recipes" links — likely `src/components/SiteHeader.tsx` or similar; grep for `href="/tonight"`).

**Interfaces:**
- Consumes: `findRecipesByPantry` (Task 2), `GET /cook-from/suggest` (Task 3), `RecipeCard`, `Have` type.

**Context:** The page reads `?have=slug,slug&time=45`, resolves the slugs to `{ id, name }` via a `payload.find` on `ingredients` (`where: { slug: { in: slugs } }`, depth 0), calls `findRecipesByPantry`, and renders three bands. `PantryFinder` is the client control: chips (each `{ slug, name }`), a debounced autocomplete input hitting `/cook-from/suggest`, an optional time `<Select>` (reuse `controls.tsx`), and it writes the URL (`router.push`) + mirrors the pantry to `localStorage['palate:pantry']`. Match `FilterPanel`'s commit/debounce feel.

- [ ] **Step 1: Build `PantryFinder`** (`src/components/PantryFinder.tsx`, `'use client'`):
  - Props: `{ initialHave: Array<{ slug: string; name: string }>, initialTime: number | null }`.
  - State seeded from props; on mount, if the URL has no `have` but `localStorage['palate:pantry']` does, offer/restore it (write URL).
  - Autocomplete: debounce input (~200ms), `fetch('/cook-from/suggest?q=' + encodeURIComponent(q))`, show a dropdown of `{slug,name}`; selecting adds a chip (dedupe by slug) and updates the URL.
  - Chips: removable (✕), reuse the `chip` class / house style.
  - Time: a `Select` of the same buckets used in filters (Any / 15 / 30 / 45 / 60 min) → sets `time` in the URL.
  - URL write: build `?have=<slugs joined>&time=<min>` and `router.push`; persist `{have}` to `localStorage`.
  - Uses `border-rule`, `text-flame`, `eyebrow`, focus-`border-flame` per house style.

- [ ] **Step 2: Build the page** (`src/app/(frontend)/cook-from/page.tsx`, server):
  - `export const dynamic = 'force-dynamic'` (results depend on query).
  - Parse `searchParams.have` (comma slugs) + `time`.
  - Resolve slugs → `{id,name}[]` via `payload.find({ collection:'ingredients', where:{ slug:{ in: slugs } }, depth:0, limit: 50 })`.
  - `const bands = await findRecipesByPantry(have, { maxMinutes })`.
  - Render: a hero/eyebrow ("What can I make?"), `<PantryFinder initialHave=… initialTime=… />`, then the three bands. Each band: a section header ("Cook now" / "One or two away" / "Getting there") shown only when non-empty; a grid of `RecipeCard`, each followed by a small footer line when `missing.length` — "You'd still need: feta, cilantro" — and, when `viaSub.length`, "use yogurt for buttermilk". Because `RecipeCard` takes a `recipe`, render the missing/sub footer as a sibling under each card (wrap card + footer in a cell).
  - Empty state (no `have`): a friendly invite to add the first ingredient; no bands.
  - Zero results with input: "Nothing matches yet — try adding a common ingredient, or drop the time cap."
  - Add `generateMetadata`/static `metadata` with a title.

- [ ] **Step 3: Nav link** — grep `href="/tonight"` to find the nav component; add a `Cook from` link (route `/cook-from`) next to Tonight, matching the existing link markup exactly.

- [ ] **Step 4: Verify in the browser** (dev server up):
  - Open `/cook-from`, add "chicken thigh" + "onion" (+ others from the seeded catalog) via autocomplete; confirm a "Cook now" and/or near-miss band renders with correct missing lists. Confirm staples (salt) never appear as missing. Confirm the URL updates and a reload restores the pantry.
  - `read_console_messages` clean; screenshot the result.
- [ ] **Step 5: Commit** — `git add "src/app/(frontend)/cook-from/" src/components/PantryFinder.tsx <navfile> && git commit -m "feat(pantry): /cook-from page, PantryFinder, and nav link"`

---

## Self-Review Notes

- **Spec coverage:** coverage/staples/subs/banding (Task 1) ✓; query + data prerequisite (Task 2) ✓; autocomplete (Task 3) ✓; page + client + nav + persistence (Task 4) ✓.
- **Types:** `Have`, `RequiredIngredient`, `Scored`, `Bands` defined once in Task 1, imported by Tasks 2 & 4. `SubRow` reused from `substitutions.ts`.
- **Risk:** substitution coverage depends on `substitutions[].sub` resolving at `depth: 2` — the query uses depth 2. If a recipe's ingredients aren't linked (pre-normalize), it simply won't match; Task 2's catalog pass mitigates. `bandRecipes` must be verified to never surface a recipe using none of the cook's ingredients (test covers `uses-none`).
- **YAGNI:** no freeform (non-catalog) ingredient input, no shopping list, no account pantry — all named out of scope.
```
