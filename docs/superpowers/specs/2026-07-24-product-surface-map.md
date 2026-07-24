# Palate — Product Surface Map (as-built)

**Date:** 2026-07-24
**Status:** Reference (living inventory of what exists today)
**Purpose:** One place that names every page, endpoint, data store and core
library, and says what each does. Not a design doc — a map.

## Stack at a glance

- **Framework:** Next.js (App Router) under `src/app/(frontend)` — public site —
  and `src/app/(payload)` — the Payload admin/API.
- **CMS + content DB:** Payload CMS 3 on local Postgres (`recipes_dev`). Owns all
  recipe/editorial content and partnership records.
- **User-data DB:** Supabase (cloud) — identity + everything a signed-in person
  owns (collections, plan, pantry, taste, shares, subscriptions, households).
  All UI degrades gracefully when Supabase/Stripe env is absent.
- **Design system:** "kitchen pass" — Young Serif / IBM Plex Mono / Figtree,
  cast-iron-green chrome, flame accent (gas-blue in dark), theme via
  `light-dark()` + `data-theme`.
- **Media:** Payload uploads → Vercel Blob in production, local disk in dev.

---

## Public pages (`src/app/(frontend)`)

### Discover & decide
| Route | What it does | Render |
|---|---|---|
| `/` | Home: "Cook first" hero, the taste-quiz teaser, "on the board" recipes, cuisine rail. | ISR |
| `/tonight` | "Pick dinner for me" — five taps (heat/sweetness/richness/effort/time) → one confident recipe, reroll without repeats. | ISR shell + client picker |
| `/cook-from` | Pantry search: add ingredients → recipes sorted into can-cook / one-or-two-away / bigger-trip, substitution-aware, staples excluded. | Dynamic (reads pantry) |
| `/taste` | Taste-profile onboarding: rate known dishes → inferred taste vector, saved to Supabase, seeds /tonight + catalog sort. | Dynamic |
| `/taste-night` | Taste Night quiz game (8 questions); every answer nudges a hidden vector; ends with a score + recommended recipe. | ISR shell + client |
| `/students` | "Studying hard?" — feeding modes (solo/batch/two/people-over/flat), budget shortcuts, pre-scaled party links. | ISR |

### Catalog & browse
| Route | What it does | Render |
|---|---|---|
| `/recipes` | The faceted catalog: filter by taste axes + meal + main ingredient + cuisine + diet + calories + difficulty + time; sort incl. "for your taste". | ISR |
| `/recipes/[slug]` | Recipe detail: ingredients (adaptive servings, US/metric, substitutions), method, per-step cook timing, nutrition strip, rating, brand slot, cook-mode launcher, add-to-plan/save. JSON-LD. | ISR (static params) |
| `/cuisines` | Index of world-cuisine hubs (208 seeded; zero-recipe hubs hidden). | ISR |
| `/cuisine/[slug]` | One cuisine hub — its recipes + editorial framing. | ISR |
| `/browse` | Collection landing pages (curated preset-filter views). | ISR |
| `/browse/[slug]` | A specific curated collection (preset filter → catalog results, SEO pages). | ISR |

### Accounts, creators, social
| Route | What it does | Render |
|---|---|---|
| `/account` | Sign in / up (two-track cook \| creator), profile, username, avatar, bio, saved count, **membership tier** (SupporterStatus). | Dynamic |
| `/collections` | The user's saved-recipe collections (named shelves). | Dynamic |
| `/creator/[handle]` | Public creator profile — bio, verified tick, their recipes, follow button. | ISR |
| `/feed` | Recipes from creators you follow. | Dynamic |
| `/studio` | Creator Studio: recipe upload form (live preview), "how publishing works" (50% deal), my submissions, my earnings. | Dynamic |

### Planning & sharing
| Route | What it does | Render |
|---|---|---|
| `/plan` | Weekly meal board (recipes → day + meal slot) + consolidated shopping list (dish-grouped collapsible sections + netted "Everything to buy"), budget rollup, leftover chains, pantry "have it", Share-this-week, **Shop this list** (grocery), household chip. | Dynamic |
| `/plan/shared/[token]` | Public, read-only shared week: the WeekCard + shopping list + grocery panel + Download image / Download PDF / Copy link. `/plan/shared/sample` previews it without auth. | Dynamic |
| `/household` | Household mode: create (supporter) / join by code / members / leave-or-disband. Shares one plan + pantry + list. | Dynamic |
| `/household/join/[code]` | Invite-link landing — confirm to join (no mutation on GET). | Dynamic |

### Monetization & trust
| Route | What it does | Render |
|---|---|---|
| `/support` | Become a supporter (Stripe) — the pitch, perks now (Household) + later (host mode, taste reports, Palate Kitchen). | Dynamic |
| `/partners` | Advertiser intake form (public) → moderated partner request. | ISR |
| `/about` | Who Palate is; the cook-first ethos; the honest-ad stance. | Static |
| `/terms` | Terms + Advertising & Partners section (labeling, rev-share policy). | Static |
| `/privacy` | Privacy policy. | Static |

### System pages
`loading.tsx` (root, cuisines, recipes) · `error.tsx` · `not-found.tsx` ·
`[...notFound]` catch-all · `robots.ts` · `sitemap.ts` (covers recipes,
cuisines, browse, creators).

---

## API / route handlers (`src/app/(frontend)/**/route.ts`)

| Endpoint | Method | What it does |
|---|---|---|
| `/tonight/pick` | GET | Runs the taste→recipe engine for the /tonight picker. |
| `/cook-from/suggest` | GET | Pantry → ranked recipe suggestions + missing items. |
| `/taste-night/dishes` | GET | Serves quiz dishes/rounds. |
| `/search-suggest` | GET | Navbar completions (in-memory 5-min TTL index). |
| `/recipe/rate` | GET/POST | Read + submit community ratings. |
| `/account/avatar` | POST | Upload avatar. |
| `/account/bio` | GET/POST | Read + save 160-char creator bio. |
| `/account/username` | POST | Claim/change @handle. |
| `/account/username-available` | GET | Live handle-availability check. |
| `/studio/submit` | POST | Creator recipe submission → `submissions` (moderated). |
| `/studio/submissions` | GET | Creator's own submissions + status. |
| `/studio/earnings` | GET | Creator's estimated per-recipe + total earnings. |
| `/partners/apply` | POST | Public advertiser application → `partnerRequests`. |
| `/brand-slot` | GET | Selects + renders the geo/recipe-matched partner card; logs impression. |
| `/brand-slot/click` | GET | Click redirect (destination rebuilt server-side) + logs click. |
| `/grocery/click` | GET | Grocery handoff redirect (URL rebuilt from retailer template) + logs click. |
| `/support/checkout` | POST | Starts Stripe Checkout for the supporter subscription. |
| `/support/portal` | POST | Opens the Stripe Customer Portal (manage/cancel). |
| `/api/stripe/webhook` | POST | Verifies signature; upserts `subscriptions` (service role). |
| `/household/create` | POST | Creates a household (supporter-gated, service role). |
| `/household/join` | POST | Joins by code via `join_household` RPC. |
| `/household/leave` | POST | Leave (member) or disband (owner). |

---

## Payload collections (content + partnership records)

| Collection | Holds |
|---|---|
| `recipes` | The catalog: content, taste axes, ingredients (canonical-linked), steps + timing, nutrition, cost, constraints, provenance, finish/leftovers, brand slots. |
| `ingredients` | Canonical ingredient backbone: aliases, substitutions, per-100g nutrition, density/grams-per-piece. |
| `cuisines` | World-cuisine hubs (name, flag, region, editorial). |
| `authors` | Creator profiles (handle, bio, verified). |
| `submissions` | Creator recipe uploads awaiting moderation; approval hook promotes to a published recipe + author. |
| `brandCards` | Partner placements: creative, geo/cuisine/recipe targeting, rev-share %, CPM, flight/weight. |
| `adEvents` | Impression/click log behind creator earnings. |
| `partnerRequests` | Advertiser applications; approval scaffolds an inactive brand card. |
| `groceryRetailers` | Geo grocery registry: countries, search/affiliate URL templates, priority, virtual CTR. |
| `groceryEvents` | Grocery impression/click log. |
| `ratings` | Community + editorial recipe ratings. |
| `media` | Uploads (Vercel Blob / local). |
| `users` | Payload admin users (staff), distinct from Supabase site accounts. |

---

## Supabase (per-user data + identity)

| Table | Holds | RLS |
|---|---|---|
| `collections` / `collection_items` | Named saved-recipe shelves + their items (slug/title/image snapshot). | Owner-only; items also gated to owned collection. |
| `usernames` | Authoritative unique @handle namespace. | Owner writes; `username_available(code)` RPC for leak-free checks. |
| `pantry` | On-hand ingredients + `is_staple`; `household_id` when shared. | Own OR household. |
| `taste_profile` | The 0–5 taste axes per user. | Owner-only. |
| `meal_plan` | Weekly board rows (day, meal, recipe snapshot, position); `household_id` when shared. | Own OR household. |
| `plan_shares` | Public share links — immutable `week` jsonb snapshot (+ legacy `recipe_slugs`). | Anyone reads by link; owner creates/deletes. |
| `follows` | Viewer → creator handle. | Owner-only. |
| `subscriptions` | Supporter tier (Stripe status, period end). | Owner reads; **only the webhook writes** (service role). |
| `households` / `household_members` | Shared-kitchen membership (one household per user). | Members read; service role / RPC write; anyone may leave. |

**RPCs / triggers:** `username_available` (availability), `join_household`
(join by code), `set_row_household` (BEFORE INSERT/UPDATE trigger auto-stamping
`household_id` on plan/pantry writes).

---

## Core libraries (`src/lib`)

- **Discovery/taste:** `tasteProfile.ts` + `tasteProfileStore.ts` (vectors, storage), `filters.ts` + `taxonomy.ts` (facets), `collections.ts` (curated preset views).
- **Cook:** `mealPlan.ts` (week snapshot, `consolidateShoppingList`, `buildDishShoppingList`, cost), `pantry.ts` (`findRecipesByPantry`, coverage bands), `substitutions.ts`, `units.ts` + `useUnitSystem.ts` (adaptive servings), `stepIngredients.ts`, `nutrition.ts` + `recipeNutrition.ts`.
- **Plan data:** `planData.ts` (server reads, household-scoped), `household.ts` (scope + context).
- **Exports:** `weekExport.ts` (theme/font/image resolution), `weekCardCanvas.ts` (PNG card), `weekCardPdf.ts` (PDF card + list).
- **Monetization:** `brandCards/*` (select + resolve), `adEvents.ts`, `grocery.ts` + `groceryData.ts`, `stripe.ts` + `stripeWebhook.ts`, `entitlements.ts`, `partners.ts`, `recipeLimits.ts`.
- **Platform:** `queries.ts` (Payload client + finders), `supabase/{client,server,admin}.ts`, `media.ts`, `lexical.ts`, `format.ts`, `site.ts`, `consent.ts`, `username.ts`.

## Data / seed scripts (`package.json`)

`seed` (catalog + admin) · `seed:cuisines` (208 hubs) · `seed:grocery` (retailers) ·
`seed:nutrition` + `compute:nutrition` · `seed:cook-depth` · `clean:ingredients` ·
`normalize:catalog` · `seed:constraints`. *(The Spoonacular/Edamam import
pipeline was removed with the creator pivot — see `chore: remove dead code`.)*

---

## Cross-cutting

- **SEO:** JSON-LD on recipes, sitemap, canonical URLs; imported/low-trust
  content is noindex (little remains post-pivot).
- **Consent + analytics:** `ConsentManager` gates GA4 (`GoogleAnalytics`); privacy-first defaults.
- **Theme:** `ThemeToggle` + `data-theme`; every surface incl. canvas exports is theme-aware.
- **Nav:** `SiteHeader` / `HeaderNav` / `MobileNav` / `NavSearch` / `NavAccount`; `SiteFooter` (Cook / Browse / Sort-by-taste / company nav incl. Support us).

## Pending owner actions (not code)
Re-run `supabase/schema.sql` (subscriptions + household); configure Stripe
(product/price/webhook + envs); add grocery affiliate templates in /admin once
programs are approved. See `2026-07-24-grocery-supporter-household-design.md`.
