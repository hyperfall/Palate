# Palate Phase 1 — Foundation + Cook Depth (design spec)

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-22
**Predecessor:** `docs/2026-07-19-product-roadmap.md`
**Part of:** the roadmap's four-phase sequence (this is Phase 1 of 4:
Foundation+Cook → Decision → Planning/Retention → Growth).

## Goal

Lay the **ingredient-intelligence keystone** the rest of the roadmap depends on,
and cash it in immediately with cook-depth features that compound trust. Four
deliverables in one spec:

1. Canonical ingredient normalization (the backbone)
2. Smart substitutions
3. Adaptive servings v2
4. Per-step ingredient timing

**Sourcing decision (approved):** *hybrid* — deterministic normalization is the
backbone; an optional, key-gated LLM accelerator proposes the softer editorial
content (aliases, substitutions, step→ingredient links) for human review. Runtime
never depends on the LLM.

**Context that shapes scope:** recipe ingredients are already structured as
`{ quantity, unit, item, note }`, so normalization resolves the `item` string to a
canonical ingredient — it does not parse raw text. The catalog is currently ~16
authored recipes, so the *data* pass is cheap; the **system** must scale to
creator submissions and future imports.

## Out of scope (named to prevent creep)

- Weight ⇄ volume conversion that requires per-ingredient density, except where a
  density hint is explicitly known. No fabricated precision.
- Ingredient-aware "what can I make" search (Phase 2 — it consumes this backbone).
- Any planning/shopping-list netting (Phase 3).
- A public-facing enrichment/review UI beyond Payload admin.

## Data model

### New collection: `ingredients` (canonical)
- `name` — canonical display name, e.g. "olive oil" (required)
- `slug` — from name (unique)
- `aliases` — text array: "extra-virgin olive oil", "EVOO", "olive oil (light)"
- `category` — select: produce, dairy, protein, oil-fat, grain-legume, spice-herb,
  condiment, bakery, other
- `countable` — boolean; discrete items (eggs, garlic cloves) — drives
  awkward-measure logic
- `densityGPerMl` — optional number; enables weight⇄volume only when known
- `substitutions` — array of `{ sub (relationship→ingredients OR text), kind
  (flavor | texture | cupboard), note, ratio }`
- `needsReview` — boolean; set when auto-created by normalization or the accelerator

### `recipes.ingredients[]` (existing array) — additions
- `ingredient` — relationship → `ingredients` (the normalized link)
- `needsReview` — boolean; set when the `item` couldn't be confidently resolved

### `recipes.steps[]` (existing array) — additions
- `uses` — relationship (hasMany) → `ingredients`; which canonical ingredients this
  step consumes

## 1. Normalization at ingest (deterministic backbone)

A recipe `beforeChange` (or `afterChange`) hook resolves each ingredient row that
lacks an `ingredient` link:

1. Normalize the `item`: lowercase, trim, singularize, strip common descriptors
   (chopped, fresh, diced, to taste, etc.).
2. Match against `ingredients` `name` + `aliases`: exact → then fuzzy (bounded edit
   distance / token overlap).
3. **Hit** → set `ingredient`. **Miss** → create a draft `ingredients` doc
   (`needsReview: true`) from the normalized string and link it; set the row's
   `needsReview: true`.

Editors resolve `needsReview` items in /admin (merge duplicates, add aliases). The
alias list compounds — each correction makes future matching better. Idempotent:
re-saving a recipe never re-resolves an already-linked row.

## 2. Smart substitutions

- Data lives on `ingredients.substitutions[]`, grouped by `kind`.
- **Recipe page:** each ingredient in `IngredientsPanel` becomes tappable →
  a popover/disclosure grouped as **"Closest flavor / Closest texture / Probably in
  your cupboard,"** each with a short note and ratio when relevant.
- **Cooking mode:** the same substitutions are reachable from the ingredients rail.
- Runtime is a pure data read (no LLM at request time). Ingredients with no
  curated subs simply show no affordance.

## 3. Adaptive servings v2

Extends the panel's existing servings scaling:

- **Unit toggle (US ⇄ metric):** convert tbsp↔ml, tsp↔ml, cup↔ml, oz↔g, lb↔kg, and
  °F↔°C in step text. A shared units/conversion module; the choice persists as a
  (necessary/preference) client setting.
- **Awkward-measure humanizing:** "1.33 eggs" → "1 egg + 1 yolk"; "0.5 tbsp" →
  "1½ tsp"; snap to friendly fractions; `countable` ingredients never show
  fractional counts without a sensible split.
- **Advisory notes at large scales:** heuristic, e.g. "At 2×, use a wider pan and
  add ~10 min" — derived from scale factor + `totalMinutes`. Advisory only.
- Compute is client-side in the panel + the units module. Weight⇄volume only when
  `densityGPerMl` is set.

## 4. Per-step ingredient timing

- Populate `steps[].uses`.
- **Cooking mode:** each step shows a compact **"You'll need: butter, garlic"** chip
  row, and a **prep-ahead nudge** ("take the butter out now") surfaced a step early,
  derived from an ingredient's first-use step.
- Graceful when `uses` is empty (no chips, no nudge).

## The hybrid accelerator (optional, key-gated)

A Node script — `npm run enrich` — that, for recipes/ingredients missing data,
calls OpenAI to **propose**:
- alias suggestions for `needsReview` canonical ingredients,
- `substitutions[]` per ingredient,
- `steps[].uses` inferred from step text.

All proposals are written as **draft / `needsReview`** into Payload; editors approve
or edit in /admin. Runtime reads only approved data. Requires `OPENAI_API_KEY`
(added later, like `NEXT_PUBLIC_GA_ID`); until then, deterministic normalization +
manual curation fully work and the accelerator is simply unavailable. Documented in
`.env.example`.

## Success criteria

- Every recipe ingredient row is either linked to a canonical ingredient or flagged
  `needsReview`; no silent misses.
- Tapping an ingredient with curated subs shows them grouped by kind, on both the
  recipe page and in cooking mode.
- Changing servings yields humane measures; the US⇄metric toggle converts correctly;
  no fractional egg counts.
- In cooking mode, steps with `uses` show the ingredient chips and a prep-ahead nudge.
- `npm run enrich` populates draft data for review when `OPENAI_API_KEY` is set, and
  fails gracefully (clear message) when it isn't.

## Dependencies & risks

- **Payload schema push** creates the new collection + fields in dev automatically;
  a types regen (`npm run generate:types`) is required so the new relations are typed.
- **Normalization false-merges** are the main risk — fuzzy matching could link
  "cream" to "sour cream". Mitigation: conservative fuzzy threshold, prefer
  `needsReview` over a wrong link, editor review as the safety net.
- The enrichment accelerator is **strictly additive** and never blocks the runtime.
