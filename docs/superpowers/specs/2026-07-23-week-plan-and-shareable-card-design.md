# Week Planning & the Shareable Week Card — Design

**Date:** 2026-07-23
**Status:** Design — pending review

## Goal: close the loop

**Discover a recipe → add it to your week → shape the week → share it as a
beautiful card (PDF/image) → whoever receives it clicks back in → plans their
own week.** The shareable card is not just a feature — it is Palate's one
organic distribution surface. Every shared week links home. Novelty and growth
are the same bet.

## Resolved design decisions (veto on review)

1. **A "day" is one dinner-centric slot that can hold one or more dishes.** No
   breakfast/lunch/dinner meal-type slots in v1 — it matches the cook-first,
   "what do I make tonight" focus and keeps the card clean (7 days, a dish
   line per day). Meal-type slots are a later, additive change.
2. **The recipe page stays about the dish.** Week-awareness is a *quiet,
   stateful button*, not a week widget: "On your Wednesday · change · remove"
   when planned, "Add to week" + a day picker when not. Nothing else competes
   with the recipe.
3. **One card design for v1: a portrait "This week's service" menu card**, in
   the kitchen-pass language. Exports as **PDF** (print → fridge) and **PNG**
   (image → chat/story). A dedicated 9:16 social vertical is deferred to Stage 4/later.
4. **Export tech = single source of truth.** The card is a real, beautiful HTML
   page (it *is* the share link). "Save as PDF" uses print-optimized CSS +
   `window.print()` (zero deps, perfect fidelity). "Download image" renders the
   card element to PNG client-side (`modern-screenshot`/`html-to-image`).
   Satori/`@vercel/og` is noted as the robust server-render upgrade if we later
   want auto-generated OG/social preview images.
5. **A share snapshots the week.** Today `plan_shares` stores only a flat
   `recipe_slugs[]` — it loses the day structure the card needs, and it mutates
   if the user changes their plan. A share must snapshot **{title, weekOf,
   days: [{day, dishes:[{slug, title, servings}]}]}** so the card is faithful
   and immutable.

## Stage 1 — Recipe ↔ Plan (the on-ramp)
- `AddToPlan` becomes week-aware: reads the signed-in user's current week, shows
  the day if the dish is already planned, and supports add / change-day / remove
  inline.
- A compact "in your week" indicator on the recipe page (quiet, cook-first).

## Stage 2 — The Plan board (the workspace)
- **Per-day servings** — scale a recipe for the night you feed six; flows into
  the shopping-list math and the card.
- **Move / reorder** dishes across days.
- Optional light **cooked / tonight** state so the week feels alive.
- Shopping list (netted, staples dropped), cost rollup, and leftover chains stay
  the quiet superpowers.

## Stage 3 — The shareable week card (the artifact)
- Replace the plain `/plan/shared/[token]` page with the **designed card**.
- Content: header (name / "week of {date}"), the 7 days as menu lines — day ·
  dish · a small photo or taste dots · time — an optional shopping-list panel on
  the flip side, and the Palate wordmark + link at the foot (the loop).
- Kitchen-pass styling: Young Serif, IBM Plex Mono, flame, ticket surfaces.
- Actions on the card page: **Save as PDF** (print), **Download image** (PNG),
  **Copy link**.

## Stage 4 — Refine & polish
- Card visual polish; **print fidelity** (page size, margins, no UI chrome);
  **image-export fidelity** (fonts embedded, media images CORS-clean same-origin).
- Edge/empty states: a partial week, days with no photo, a one-dish week.
- Accessibility, performance, and the recipe-page integration polish.
- Optional: the 9:16 social vertical variant; smarter "week of" date handling.

## Data model (Supabase)
- **Plan entries** (existing): add `servings` (int, nullable) and `position`
  (int) per entry.
- **`plan_shares`** (existing): change from `recipe_slugs[]` to a structured
  **`week` JSON snapshot** ({title, weekOf, days}) captured at share time. Keep
  reading old rows for back-compat (fall back to slugs → undated list).

## Files (high level)
- `src/lib/mealPlan.ts`, `src/lib/planData.ts` — week shape + snapshot builder.
- `src/components/AddToPlan.tsx` — stateful/week-aware.
- `src/components/MealBoard.tsx` — servings, reorder, state.
- `src/components/SharePlan.tsx` — snapshot the week.
- `src/app/(frontend)/plan/page.tsx`, `plan/shared/[token]/page.tsx` — the card.
- New: `WeekCard` component, PNG-export util, print CSS.

## Suggested build sequence
1. **Data model** — plan-entry servings/position + `plan_shares` week snapshot.
2. **Stage 3 card + exports** — the card defines the data; building it validates
   the model and delivers the novelty early.
3. **Stage 2 board improvements** — servings, reorder, state.
4. **Stage 1 recipe integration** — week-aware `AddToPlan`.
5. **Stage 4 refine & polish.**

## Out of scope (v1)
Meal-type slots · multi-week / recurring plans · collaborative editing · the
9:16 social variant (deferred to Stage 4).

## Verification
Pure `mealPlan` snapshot/shape logic unit-tested. Card renders across widths and
prints clean (verified in-browser). PNG export produces a valid image. Signed-in
plan flows are user-verified (Supabase, auth-gated). tsc + existing tests green.

## Note
The card is inherently visual — when we build Stage 3 I can spin up the
brainstorming **visual companion** to mock 2–3 card looks in a browser before
committing to one.
