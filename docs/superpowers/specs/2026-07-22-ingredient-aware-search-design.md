# Ingredient-Aware Search ("Cook from your kitchen") — design spec

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-22
**Part of:** Phase 2 (Decision layer), subsystem 1 of 3 — ingredient-aware search → constraint stacking → taste onboarding.
**Depends on:** the shipped ingredient-normalization backbone (canonical `ingredients`, aliases, `recipes.ingredients[].ingredient` links, `ingredients.substitutions[]`).

## Goal

Let a cook enter the ingredients they have and see what they can make — "Cook now" recipes first, then near-misses that spell out exactly what's still needed. This is the headline Decision feature and the first real payoff of the normalization backbone.

## User flow

A new page `/cook-from` ("What can I make?"), linked in the nav beside `/tonight`. The cook adds ingredients as chips (autocompleted from the canonical ingredient catalog), optionally caps total time, and gets a ranked, banded result. The pantry persists in `localStorage` (no accounts — account-backed pantry is Phase 3). URL carries state (`?have=chicken-thigh,spinach,rice&time=35`) so results are shareable and server-rendered.

## Matching model

Resolve each chip to a canonical ingredient id (chips are chosen from the catalog, so they carry slugs; the server loads ids + names by slug). For each **published** recipe with canonical ingredient links:

- `required` = the recipe's canonical ingredient ids **minus assumed pantry staples**.
- `covered` = ids you have, **plus** any `required` id for which you have a curated substitute (from `ingredients.substitutions[]` — the sub resolves to an ingredient you hold, or you hold a catalog ingredient whose name matches the sub). Substitution coverage is a separable layer that activates wherever sub data exists.
- `missing` = `required − covered`, surfaced as ingredient names.

**Assumed pantry staples** (never counted as missing): salt, black pepper, water, olive oil, oil, butter. Defined as a `STAPLES` set of canonical names in `src/lib/pantry.ts` (a code constant for v1; can migrate to an `ingredients.pantryStaple` flag later without changing callers).

**Bands** (each result card shows its missing list explicitly):
- **Cook now** — `missing.length === 0`.
- **One or two away** — `missing.length` is 1–2.
- **Getting there** — `missing.length` 3–5.
Recipes that use fewer than 2 of the entered ingredients, or are missing more than 5, are not shown (no near-useless matches). Within the whole result, rank by `missing.length` ascending, then by match ratio (`covered / required`) descending. Optional `time` cap filters on `totalMinutes` (reuses the catalog's time semantics).

A recipe whose coverage used a substitute notes it on the card ("use yogurt for buttermilk").

## Components & data flow

- **`src/lib/pantry.ts`** (pure, unit-tested): `STAPLES`; `computeCoverage(required, subsByIngredientId, haveIds)` → `{ missing: string[], viaSub: Array<{ item: string; sub: string }> }`; `bandRecipes(scored)` → the three bands with the stated cutoffs and ranking. No I/O.
- **`findRecipesByPantry(haveIds, { maxMinutes })`** in `src/lib/queries.ts`: loads published recipes at `depth: 2` (ingredient links + their substitutions resolve), runs `computeCoverage`, applies the cutoffs, returns scored+banded results.
- **`/cook-from/suggest`** route: ingredient autocomplete — canonical ingredients matching a query by name/alias, `{ slug, name }`, capped (~8). Served from the canonical catalog.
- **`/cook-from/page.tsx`** (server): reads `?have`/`?time`, resolves slugs → ids/names, calls `findRecipesByPantry`, renders the bands with `RecipeCard` + a "you'd still need…" footer. Empty/zero-input state invites the first ingredient.
- **`PantryFinder`** (client): the chip input + autocomplete + time cap; writes URL (like `FilterPanel`'s commit pattern) and mirrors the pantry to `localStorage`.
- **Nav:** a "Cook from" entry near "Tonight".

## Data prerequisite

Only recipes whose rows are linked to canonical ingredients can match. The normalization hook links on save, but the existing 16 recipes need a one-time pass: `npm run normalize:catalog` re-saves every recipe (triggering the linking hook). It runs against the now-clean canonical set, so links are clean.

## Out of scope (named to prevent creep)

- Account-backed pantry / cross-device sync (Phase 3).
- Budget, equipment, one-pan constraints — that's Phase 2 subsystem 2 (constraint stacking).
- Shopping-list generation from the missing items (Phase 3 planning layer).
- Freeform typed ingredients that aren't in the catalog — v1 constrains input to autocompleted canonical ingredients; a fuzzy free-text fallback can come later.

## Success criteria

- Entering ingredients yields a "Cook now" band (recipes fully covered minus staples) above near-miss bands, each near-miss listing exactly what's missing.
- Substitution coverage works where data exists: a missing item you have a curated sub for is counted and the swap is shown.
- Staples are never listed as missing.
- The pantry persists across visits and the URL is shareable/server-rendered.
- `npm run normalize:catalog` links the existing catalog so results aren't empty.
```
