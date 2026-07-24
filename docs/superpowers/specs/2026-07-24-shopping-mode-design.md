# Shopping Mode — focused, household-synced checklist

**Date:** 2026-07-24
**Status:** Approved (design)

## Problem / goal

The shopping list is a reference; shopping is an activity. Add a focused,
full-screen "Shopping Mode" you use in the aisles: big tap targets, check items
off, they cross out and sink into a basket, progress is visible, and — since the
plan can be a household's — checks **sync live** across members.

## Decisions (from brainstorming)

- **Persistence:** household-synced (Supabase), shared live via realtime. Solo
  cooks get a personal basket that still persists across their devices.
- **Organisation:** netted "everything to buy" by default, with a **by-dish**
  toggle. Checked items sink to an "In the basket" section, struck through.
- **Clear all:** clears the whole (shared) basket — it's a shared list.

## 1. Data — `shopping_checks`

```
shopping_checks: id uuid pk, user_id uuid default auth.uid(),
                 household_id uuid null, item_key text, created_at timestamptz
```
- A row means "in the basket"; check = insert, uncheck = delete by `item_key`.
- Reuses the household machinery: the `set_row_household` BEFORE INSERT/UPDATE
  trigger auto-stamps `household_id`; RLS is `own OR household_id =
  my_household_id()` (the recursion-safe helper). Household members share one
  basket; a non-member's rows are personal (household_id null).
- Partial unique indexes prevent double-checks:
  `(household_id, item_key) where household_id is not null` and
  `(user_id, item_key) where household_id is null`.
- Added to the `supabase_realtime` publication so members get live updates.
- `item_key` is the stable `ShoppingLine.key` (`id:<canonicalId>` / `name:<x>`),
  so checks survive reloads and reconcile when the week changes (orphaned keys
  are ignored on render; new items default unchecked). The same canonical key in
  the netted and by-dish views means a check reads consistently across both.

## 2. `useShoppingChecks` hook (`src/lib/useShoppingChecks.ts`)

Owns a `Set<string>` of checked keys.
- **Load:** `select item_key from shopping_checks` (RLS-scoped) → the set.
- **toggle(key):** optimistic flip; then insert (check) or delete-by-item_key
  (uncheck). Insert swallows a unique-violation (already checked by someone).
  On error, reverts the optimistic change.
- **clearAll():** delete all rows in scope.
- **Realtime:** subscribe to `postgres_changes` on `shopping_checks`; merge
  INSERT/DELETE into the set (RLS scopes the stream to own+household).
- **Degrade:** if Supabase/realtime is unavailable, fall back to in-memory
  state so the mode still works offline/unconfigured.

## 3. `ShoppingMode` overlay (`src/components/ShoppingMode.tsx`)

Full-screen `fixed inset-0 z-50` overlay (the Cook-Mode pattern), mobile-first:
- **Header:** title, progress bar + "N of M in the basket", close (Esc / button).
- **View toggle:** All (netted) ⇄ By dish.
- **Rows:** large; tap anywhere toggles. Checked → strikethrough + dim + sink to
  an **"In the basket (n)"** section; tap to restore. Amounts shown
  (`garlic — 2`). A subtle checkbox glyph animates on check
  (respecting `prefers-reduced-motion`).
- **Wake lock** while open (screen stays awake), released on close.
- **Empty/all-done:** a "Basket complete" state when every item is checked.
- **Household:** a quiet "Shared with your household" line when in one; rows
  update live as others check.
- **Clear all** resets the (shared) basket.

## 4. Launcher + placement

`ShoppingModeLauncher` — a "Shopping mode →" button on `/plan`, beside the
shopping list, shown only when there's something to buy and the viewer is signed
in (checks need auth). The public shared page keeps its static list for v1.

## 5. Files

- **Schema:** `shopping_checks` block + realtime publication line in
  `supabase/schema.sql` (idempotent).
- **New:** `src/lib/useShoppingChecks.ts`, `src/components/ShoppingMode.tsx`
  (overlay + launcher).
- **Changed:** `src/app/(frontend)/plan/page.tsx` (mount the launcher, pass the
  already-computed `shopping`).

## Testing

- `tsc` clean; suite green (no pure-lib changes; the hook/overlay are UI).
- Structure verified locally in the browser (overlay opens, toggle/cross-out,
  progress, by-dish view, wake lock best-effort).
- Sync/RLS/realtime are cloud + auth gated → user-verified with the schema
  re-run and two sessions.

## Non-goals (v1)

- Shopping mode on the public shared page (no auth for checks).
- Aisle/category grouping (no reliable per-ingredient aisle data yet).
- Assigning items to specific members.
