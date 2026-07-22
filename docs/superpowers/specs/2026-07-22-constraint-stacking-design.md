# Constraint Stacking — design spec (Phase 2.2)

**Status:** Built. **Date:** 2026-07-22. **Part of:** Phase 2 (Decision layer), subsystem 2 of 3.

## Goal
Add kitchen-reality constraints as first-class catalog facets, stackable with the existing filters, in this order: **budget per serving → equipment/one-pan → make-ahead → leftovers-friendly**.

## Decisions
- **UI:** extend the existing `/recipes` `FilterPanel` (not a separate surface) — two new facet groups: **Kitchen** (One pan · Make-ahead · Keeps well toggles, plus equipment chips) and **Budget** (per-serving cost bands). Reuses all filter infra (URL state, `buildWhere`, Clear).
- **Schema (recipeFacetFields, shared recipes+submissions):** new `equipment` (select hasMany), `onePan` (checkbox), `makeAhead` (checkbox). `costPerServing` (cents) already existed; leftovers reuses the existing `finish.storageDays`.
- **Filters (`filters.ts`):** `maxCost` (cost≤N cents), `equipment[]` (additive `contains`), `onePan`/`makeAhead` (equals true), `keepsWell` (`finish.storageDays ≥ 2`). URL keys: `cost`, `equip`, `onepan`, `prep`, `keeps`. All wired into parse/buildWhere/toSearchParams/countActiveFilters/Clear.
- **Data:** `npm run seed:constraints` tags all 17 authored recipes with honest per-dish editorial values (equipment, one-pan, make-ahead, rough per-serving cost; make-ahead dishes get a `storageDays` window). Editors refine in /admin.

## Out of scope
Auto-derived equipment from step text; currency conversion (cost shown as £/pence bands); the taste-onboarding subsystem (Phase 2.3).

## Verified
Filters narrow and stack correctly (one-pan → 9, no-cook → 4, cost≤£1.50 → 6, keeps-well → 12, one-pan+budget → 4); Kitchen/Budget groups render and expand with chips; `tsc` clean, 124/124 tests.
