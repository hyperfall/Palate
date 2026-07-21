# Palate — Product Roadmap (post-Phase-1)

**Status:** Working roadmap
**Date:** 2026-07-19
**Predecessor:** `2026-07-18-recipe-platform-design.md` (Phase 1 spec — built)

The Phase-1 wager stands: recipe-first, taste-measured, honestly monetised.
This roadmap layers *decision*, *execution*, and *planning* value on top.
Ordering principle: ship what compounds trust before what compounds revenue.

---

## Shipped (as of this doc)

- ✅ Phase-1 site: catalog, faceted filters (taste + meal + built-on + time +
  diet + calories + difficulty), cuisine hubs, recipe pages, brand slots,
  JSON-LD, dark mode, navbar search with quick-fact completions.
- ✅ Spoonacular ingestion across all 26 supported cuisines
  (`provenance: api-imported`, attribution + noindex), auto-refreshed on
  `npm run dev` behind a 20h quota stamp.
- ✅ **"Pick dinner for me"** (`/tonight`): five taps — heat, sweetness,
  richness, effort, time — one confident recipe, reroll without repeats.
- ✅ **Cooking mode** on every recipe: full-screen steps, wake lock, per-step
  timers with chime, keyboard/tap controls, finish notes.

## Now — make recipes executable (rest of the tier)

- **Ingredient timing**: per-step ingredient callouts ("take the butter out
  now") derived from step order; needs `steps[].ingredientRefs` in the schema.
- **Adaptive servings v2**: unit conversion (metric ⇄ US), awkward-measure
  flags ("1.33 eggs" → "1 egg + 1 yolk"), pan-size/cook-time notes at 2×.
- **Smart substitutions**: per-ingredient ranked subs — closest flavour /
  closest texture / probably-in-your-cupboard. Editorial table + fallback.
- ✅ **Failure recovery**: curated "Fix it" playbook (salty, split, undercooked
  rice, too spicy, burnt garlic, thin sauce, stuck pan) reachable from the
  cooking-mode rail at any step.
- ✅ **Finish checklist**: `finish { storageDays, reheat, leftoverIdeas }` on
  every recipe, rendered on cooking-mode's end screen (generic fallback when
  unset). Populate per-recipe in /admin.

## Shipped since: engagement + acquisition surfaces

- ✅ **Taste Night** (`/taste-night`): 8-question quiz (ingredient, technique,
  myth-buster, this-or-that formats); every answer nudges a hidden taste
  vector; ends with score + a recommended recipe via the /tonight engine.
  Later: themed packs, image rounds, host/room mode with join codes, playful
  awards, winning team picks the group's dish + shared shopping list. Paid
  tier: quiz packs, host mode, taste reports.
- ✅ **"Studying hard?"** (`/students`): feeding-mode switch (solo / batch /
  two / people-over / flat) with party links pre-scaled via `?servings=`,
  "tonight, not theory" shortcuts, leftover chains. `costPerServing` now in
  the schema + importer (US cents; fills on the next quota day) — unlocks
  under-£1/£2/£3 budget filters, "I've got £N until payday" rotations,
  base-basket plans, buy-once-cook-three-times badges, kitchen-reality
  filters (microwave-only, one pan), host timelines for people-over mode.

## Next — decision layer

- **Taste-profile onboarding**: rate 10–15 known dishes → inferred preference
  vector ("spicy, savoury, low-sweetness, medium effort") stored locally
  first (no auth in P1), seeding /tonight and catalog defaults.
- **Ingredient-aware suggestions**: "chicken thighs, spinach, rice, 35 min" →
  viable meals + missing-items list. Needs ingredient normalisation pass over
  the catalog (map freeform items → canonical ingredient keys).
- **Constraint stacking**: budget/serving, equipment, one-pan, prep-ahead,
  leftovers as first-class facets. Schema: `equipment[]`, `costBand`,
  `onePan: boolean`.

## Later — planning layer (the subscription surface)

- **Weekly board**: drag recipes into days → consolidated shopping list with
  ingredient overlap netting.
- **Budget planner**: estimated cost/portion (UK supermarket basket data),
  cheaper swaps. Depends on ingredient normalisation above.
- **Pantry memory**: tick staples once; lists stop nagging.
- **Leftover chains**: roast once → two intentional follow-ons.
- **Household mode**: merged preferences, shared exclusions.

## Positioning experiments (content strategy, not code)

- Weeknight world food for the visitor's country (geo header → supermarket
  vocabulary: Tesco/Aldi/Asda for UK).
- Taste-led Asian home cooking with honest spice/effort ratings.
- No-waste, budget-led weeks (cost, leftovers, freezer, shared ingredients).
- "Learn flavour, not recipes": sauces/bases/spice-combo building blocks.

## Trust (continuous)

- Test standard on every authored recipe: cooks, appliance, pan, brands.
- Explainable difficulty: knife skills, timing sensitivity, pans, cleanup.
- Process photos at the steps people actually ruin, not just glamour shots.
- Provenance stays visible everywhere (already enforced by `provenance`).
- Photography consistency pass — the largest visual gap in the current cards
  (imported photos vary wildly in quality).

## Dependencies worth naming

1. Ingredient normalisation unlocks: ingredient-aware suggestions, budget
   planner, pantry memory, substitutions. Do it once, early.
2. Auth/accounts unlock: profiles, boards, households. Payload users exist;
   public auth is deliberately still out of scope until a feature pays for it.
3. Spoonacular supporter key before any public launch (test key is dev-only).
