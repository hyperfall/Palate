# Taste-Profile Onboarding — design spec (Phase 2.3)

**Status:** Built. **Date:** 2026-07-22. **Part of:** Phase 2 (Decision layer), subsystem 3 of 3 — the last.

## Goal
Learn a visitor's taste from a quick "rate a few dishes" flow, then personalise /tonight and the catalog from it. Reuses the existing 4 taste axes (spiciness/sweetness/richness/effort) rather than inventing a new model.

## Decisions
- **Mechanism:** a lightweight `/taste` onboarding — tap **Love it / Not for me** on ~8 taste-varied dishes; the liked dishes' axes average into a profile vector (`inferProfile`). No accounts — stored in `localStorage['palate:taste']` via `useTasteProfile` (+ `readTasteProfile` for event handlers).
- **Applies to (recommended set, all built):**
  - **/tonight seeding** — `TonightPicker` reads the saved profile on mount and prefills the four taste answers, so a returning visitor jumps straight to "how long have you got?" (with a "start fresh" escape).
  - **"For your taste" catalog sort** — a new sort option; `SortSelect` attaches the saved profile to the URL (`?sort=foryou&tp=1-2-2-1`); `findRecipes` ranks by Euclidean distance to the vector (computed in-app over the small catalog). No profile → newest-order fallback.
  - **Entry point** — a CTA link from /tonight ("Set your taste profile"), plus the onboarding result links onward to /tonight and the taste-sorted catalog. (No blocking first-visit nudge — a link, not a nag.)
- **Pure core (`tasteProfile.ts`, tested):** `inferProfile` (centroid of liked, null if none), `distance`, `encodeVector`/`parseVector` for the URL.

## Out of scope
Account-backed profile / cross-device (Phase 3); disliked-dish repulsion (v1 averages likes only); re-rating drift over time.

## Verified
Onboarding infers + saves a vector and links to `/recipes?sort=foryou&tp=…`; the sort yields a distinct, taste-closer order; /tonight prefills from the profile and shows the note; `tsc` clean, 130/130 tests.
