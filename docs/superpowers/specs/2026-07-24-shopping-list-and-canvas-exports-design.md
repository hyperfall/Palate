# Dish-grouped shopping list + canvas exports

**Date:** 2026-07-24
**Status:** Approved (design)
**Supersedes/extends:** `2026-07-23-week-plan-and-shareable-card-design.md`

## Problem

The week-planning feature shipped, but three gaps remain:

1. **Exports are broken and limited.** "Download image" uses `html-to-image`,
   which rendered the card off-canvas in Firefox (the `mx-auto` centering margin
   baked into the SVG `foreignObject`) and is not theme-aware (dark theme kept a
   white background, washing out light text). "Save as PDF" relies on the browser
   print dialog — no control over look and feel.
2. **The shared card has no shopping list.** The new snapshot-based shared page
   (`plan_shares.week`) renders the menu card only. The older back-compat branch
   showed a consolidated list; the new one dropped it.
3. **The shopping list is a single flat netted list.** Users want a dish-grouped,
   collapsible ("Notion-style") view — "what do I need for *this* dish" — in
   addition to the netted buy-list.

## Goals

- Restructure the shopping list into **collapsible dish categories + a netted
  "Everything to buy" section**, on both the plan page and the shared card.
- Replace both exports with a **single hand-drawn `<canvas>` renderer** feeding
  PNG and PDF, that is **theme-aware** and **includes the shopping list**.
- Make the week snapshot **self-contained** so the shared card and exports render
  entirely from the frozen `plan_shares.week` payload.

## Non-goals

- No change to how plans are created/edited (MealBoard, AddToPlan).
- No server-side PDF/headless-Chromium rendering.
- No new Supabase columns (the `week jsonb` column already exists).
- Selectable/vector PDF text (canvas raster at 2× is accepted for full control).

## Decisions (resolved during brainstorming)

- **List structure:** dish-grouped categories **plus** a netted "Everything to
  buy" section (keep the canonical-id netting payoff, add the per-dish view).
- **Export engine:** one hand-drawn `<canvas>` routine feeds both PNG and PDF
  (drops `html-to-image` entirely). PNG via `canvas.toBlob`; PDF via `jsPDF`
  embedding the canvas image.
- **Export theme:** follow the current site theme for both PNG and PDF (fixes the
  dark-background bug). Achieved by reading resolved CSS variables at draw time.
- **Per-dish vs netted semantics:** per-dish sections show **full** recipe
  ingredients ("to cook this"); the netted section is **pantry-aware** on the
  plan page (staples dropped) ("to buy").
- **PDF pagination:** single content-sized "menu" page; slice into multiple pages
  only if the canvas exceeds a sane max height.

## 1. Data model — self-contained snapshot

Extend the dish shape in `src/lib/mealPlan.ts` to carry ingredients:

```ts
export type WeekDish = {
  slug: string
  title: string
  image: string | null
  ingredients: PlanIngredient[]   // NEW — the fields consolidateShoppingList consumes
}
```

`buildWeekSnapshot(entries, meta)` gains `ingredients` on each entry. Both callers
already have them:
- Plan page: `recipes.get(e.slug)?.ingredients ?? []`.
- `SharePlan`: must build the snapshot with ingredients (today it calls
  `buildWeekSnapshot(entries)` without them) — the plan page will pass an
  ingredient-carrying snapshot into `SharePlan` instead of rebuilding a thin one.

Effect: `plan_shares.week` jsonb now embeds ingredients, so the shared page
renders the full shopping list from the frozen snapshot with no dependency on live
recipe data (immutable, as intended). **Back-compat:** snapshots written before
this change have no `ingredients`; readers treat missing/empty as "no per-dish
lines" and simply render an empty/partial list.

## 2. Shopping-list logic — pure & tested (`mealPlan.ts`)

```ts
export type DishShoppingGroup = {
  slug: string
  title: string
  image: string | null
  lines: ShoppingLine[]   // this dish's ingredients (reuses ShoppingLine shape)
}
export type WeekShoppingList = {
  dishes: DishShoppingGroup[]     // one per distinct dish (deduped by slug)
  netted: ShoppingLine[]          // consolidateShoppingList across all dishes
}

export function buildDishShoppingList(
  week: WeekSnapshot,
  pantry?: Pantry,                // applied to `netted` only
): WeekShoppingList
```

- Distinct dishes deduped by `slug` (a dish planned on two days appears once).
- Each dish's `lines` come from consolidating that single dish's ingredients
  (handles a recipe listing the same item twice) — **no pantry filtering**.
- `netted` = existing `consolidateShoppingList` over all dishes, pantry-aware.
- Pure function; unit-tested alongside the existing `consolidateShoppingList`
  tests (dedupe, netting, pantry applies to netted only, empty week).

## 3. Web UI — collapsible list

**New `src/components/Disclosure.tsx`** (client): a reusable Notion-style
disclosure — a `<button>` header with a rotating chevron, `aria-expanded` /
`aria-controls`, keyboard-operable, controlled internal state with a
`defaultOpen` prop.

**`ShoppingList` reworked** to render:
- An **"Everything to buy"** section (netted), `defaultOpen`, retaining the
  "have it" staple action **only when interactive**.
- **One collapsible section per dish** (thumbnail + title + line count; collapsed
  by default).
- New prop `interactive?: boolean` (default true). The shared card passes
  `interactive={false}` → no "have it" buttons (viewer isn't signed in).

**Plan page:** aside uses `<ShoppingList>` (interactive) built from
`buildDishShoppingList(week, pantry)`.

**Shared page (`/plan/shared/[token]`):** below `<WeekCard>`, render
`<ShoppingList interactive={false}>` from `buildDishShoppingList(snapshot)`. A
thin client wrapper carries the disclosure interactivity (the page is a server
component).

## 4. Export engine — one canvas renderer

**New `src/lib/weekCardCanvas.ts`** — a framework-free drawing module:

```ts
export async function renderWeekCanvas(opts: {
  week: WeekSnapshot
  shopping: WeekShoppingList
  scale?: number        // default 2
}): Promise<HTMLCanvasElement>
```

Responsibilities:
- **Theme colors:** resolve each `--color-*` token to a concrete rgb by reading
  `getComputedStyle` off a probe element (so `light-dark()` + `data-theme` resolve
  to the active theme). No hardcoded colors.
- **Fonts:** `await document.fonts.ready`; resolve the actual family strings
  (Young Serif / IBM Plex Mono / Figtree) from probe elements carrying the
  `font-display` / mono / sans classes, so canvas `ctx.font` matches the DOM.
- **Images:** preload every dish thumbnail (same-origin `/media`) via `Image`;
  await load/error before drawing; draw rounded-rect clipped thumbnails.
- **Layout (top→bottom):** masthead (eyebrow, title, weekOf, dish count) → 7 day
  rows (day label + meals + dish rows with thumbnails) → shopping list (per-dish
  categories **expanded** + netted "Everything to buy") → footer (wordmark +
  tagline). Measures text for wrapping; returns a canvas sized to measured height.

**`WeekCardActions` rewired** (client), receives `week` + `shopping` as props:
- **Download image:** `renderWeekCanvas` → `canvas.toBlob('image/png')` →
  object-URL download (`my-week.png`).
- **Download PDF:** `renderWeekCanvas` → `jsPDF` with page sized to the canvas
  (portrait, px units); `addImage(canvas, 'PNG', …)`. If canvas height exceeds a
  max, slice into successive pages. Downloads `my-week.pdf`.
- **Copy link:** unchanged.
- Removes `window.print()`, the "Save as PDF" button, the `failed`/timeout
  plumbing specific to `html-to-image`, and the `.week-card` `@media print` block
  in `styles.css`.

**Dependencies:** add `jspdf`; remove `html-to-image`.

## 5. Layout & sizing

- Export canvas is a single tall column at the card width (~640 CSS px × `scale`):
  card, then shopping list, then footer.
- PDF: one content-sized page (menu aesthetic). Multi-page slice only past a max
  height threshold.
- Shared web page order: `WeekCard` → shopping list → export actions → "want your
  own?" CTA.

## Testing

- **Unit (pure):** `buildDishShoppingList` — dedupe by slug, per-dish full lines,
  netted pantry-aware, empty week, back-compat snapshot with no `ingredients`.
- **Type check:** `tsc` clean (the working check; eslint is broken in this repo).
- **Manual/preview (auth + canvas gated):** `/plan/shared/sample` — verify the
  card + dish-grouped list render; Download image produces a full, correctly
  themed PNG in **both light and dark** (the regression that started this);
  Download PDF opens with the same content. Collapsible toggles on the plan page.
- Firefox parity verified via the user's screenshots (canvas removes the
  `foreignObject` failure mode that only affected Firefox).

## Risks / notes

- **Canvas layout is manual code.** Mitigated by keeping the drawing module
  focused and data-driven, and by reading theme/fonts from the live DOM so it
  tracks the design system rather than duplicating constants.
- **Snapshot size** grows with embedded ingredients; acceptable for a week's
  worth of recipes in a jsonb column.
- **Font readiness:** if `document.fonts.ready` resolves before a face is used,
  canvas may fall back; drawing after an explicit `fonts.load` of each needed face
  is the guard.
