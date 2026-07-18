# Recipe Platform — Phase 1 Design Spec

**Status:** Draft for approval
**Date:** 2026-07-18
**Working codename:** `supersecretrecipewebsite` (product name TBD)

---

## 1. The wager

Every mainstream recipe site is ugly *on purpose*. The 900-word life story, the ad
walls, the "jump to recipe" button — that's not incompetence, it's ad-revenue and
SEO optimization. The bad UX **is** the business model.

This product bets the opposite: a beautiful, structured, emotionally-anchored recipe
experience can win an underserved audience — and can be monetized **without** the
pageview-farming that makes the incumbents miserable. The money model is native brand
integration + affiliate, not banner spam. That means the design isn't decoration; it's
the moat.

**Non-negotiable design principle:** recipe first. No forced scroll-past-the-story.
Any "story" is short, optional, and never blocks the cook.

---

## 2. Scope & phasing (read this before anything else)

The full vision includes a location-aware ad engine with a self-serve brand portal.
**That is a second product, and building it first is the trap that kills this idea.**
You cannot sell a brand portal to zero brands; you have zero brands until you have
traffic; you have zero traffic until the recipe site exists and is loved.

So the vision phases in without wasted work:

| Phase | What ships | When earned |
|---|---|---|
| **1 (this spec)** | Beautiful recipe site + faceted filtering + **hand-curated brand-card slots** + affiliate links + full JSON-LD SEO | Now |
| **2** | The hand-curated slot logic becomes a real DB-backed **targeting + rotation engine** | When traffic is provable to a brand |
| **3** | **Self-serve brand portal** (brands log in, buy placements, see stats) | When brands already pay via invoice and manual ops is the bottleneck |

**Key architectural decision:** design the ad *slot* into Phase 1; defer the ad
*engine* to Phase 2. The user-facing result looks identical to the final vision; the
cost is a config file instead of an ad platform. Every Phase-1 choice below is made so
Phases 2–3 slot in without a rewrite.

---

## 3. Content strategy (the make-or-break)

Hybrid, in priority order:

1. **Launch catalog — LLM-drafted, human-verified (authored quality).**
   30–50 hero recipes. An LLM produces the first draft; **you verify and edit every
   one** before publish. This is mandatory, not optional: Google actively penalizes
   unedited AI recipe spam, and an untested recipe is a food-safety/trust liability.
   Verified recipes are marked `provenance: authored`.
2. **Community / user-generated — designed now, built later.**
   The data model and moderation states exist from day one so it slots in without a
   migration. No submission UI, no user auth in Phase 1. Marked `provenance: community`.
3. **Verified API ingestion — designed now, built later.**
   A mapper from an external recipe API (e.g. Spoonacular/Edamam) into our schema,
   marked `provenance: api-imported`. Disabled at launch. **SEO caveat:** imported
   content is duplicate content across the web — it must carry canonical/attribution
   handling and must never dilute the authored catalog's ranking.

The `provenance` field is load-bearing: it drives trust signals, editorial badges,
filtering, and Google transparency. It is present on every recipe from commit one.

---

## 4. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | Specified; best-in-class SSR/SSG for SEO |
| CMS + DB | **Payload CMS 3 + Postgres** | Payload runs *inside* the Next app (`/admin`), non-devs edit content, and it's Postgres-backed — the **same DB the Phase-2 ad engine needs**. One move gets CMS + future ad-engine store. |
| Styling | **Tailwind CSS** + a small bespoke design system | Distinctive look without fighting a component library; tokens keep it consistent |
| Images | Payload media + `next/image`, backed by **Vercel Blob** (or Cloudinary) | Food photography is the product; needs real image pipeline + responsive delivery |
| Hosting | **Vercel** | Native Next + Blob + Postgres; preview deploys |
| Geo | Vercel geo headers (region/country) at the edge | Feeds location-based brand-card selection with zero extra infra |

**Rejected:** Sanity (content lives off-platform in GROQ; ad-engine data would live
elsewhere; cost scales badly). Markdown/MDX (no non-technical editing; you want a
content operation). Raw Postgres-first with a hand-built admin (rebuilds what Payload
gives free).

---

## 5. Data model

Payload collections. Fields marked ★ are the ones Phases 2–3 depend on — do not omit.

### `recipes`
- `title`, `slug` (unique)
- `heroImage`, `gallery[]`
- `story` — short, optional rich text (hard word cap enforced in the editor UI)
- `cuisine` → relationship to `cuisines`
- **Taste axes (the differentiator filters):** `spiciness` (0–5), `sweetness` (0–5),
  `richness` (0–5), `effort` (0–5)
- `dietaryTags[]` (vegan, vegetarian, gluten-free, dairy-free, …)
- `time`: `prepMinutes`, `cookMinutes`, `totalMinutes`
- `difficulty` (easy | medium | hard)
- `servings`
- `ingredients[]`: `{ quantity, unit, item, note, ★affiliateKey }`
- `steps[]`: `{ text, image?, timerSeconds? }`
- `nutrition?` (calories, protein, carbs, fat) — feeds JSON-LD
- ★`provenance` (authored | community | api-imported)
- ★`author` → relationship to `authors`
- ★`brandSlots[]` → relationship to `brandCards` (the ad slot; hand-curated in P1)
- `status` (draft | published), `publishedAt`
- SEO: `metaTitle`, `metaDescription`, `ogImage` (auto-derived if empty)

### `brandCards` (Phase 1 = hand-curated; seed of the ad engine)
- `brand`, `logo`, `productImage`, `tagline`, `ctaLabel`, `ctaUrl` (affiliate/partner)
- ★`targetRegions[]` (country/region codes; empty = global)
- ★`assignedCuisines[]` and/or `assignedRecipes[]`
- ★`weight` (int, for fair rotation)
- `active` (bool), `startsAt?`, `endsAt?`

### `cuisines`
- `name`, `slug`, `region`, `flagEmoji`/`icon`, `heroImage`, `description`

### `authors`
- `name`, `avatar`, `bio`, `provenanceDefault`

### `submissions` (designed, NOT built in P1)
- Mirrors `recipes` + `moderationStatus` (pending | approved | rejected), `submittedBy`.
  Exists in schema so community slots in without migration.

---

## 6. Ad-slot logic (Phase 1)

A single **pure function** — this is deliberately the seed of the Phase-2 engine:

```
selectBrandCards(recipe, region, sessionRotationState) -> BrandCard[]
```

1. Filter `brandCards` by `active`, date window, and eligibility
   (`assignedRecipes` contains recipe OR `assignedCuisines` contains its cuisine).
2. Filter by region (`targetRegions` empty OR contains `region`).
3. If multiple eligible, **rotate cleanly** so each brand gets fair recognition:
   weighted round-robin keyed on a per-visitor cookie (deterministic, even exposure —
   not just random, which clumps).
4. Render as a designed card in the recipe's brand slot.

In Phase 1 the eligibility data is hand-entered in Payload. In Phase 2 the *same
function signature* is backed by a real targeting service + impression/click logging.
No consumer rewrite.

---

## 7. Filtering & navigation

- **Catalog** (`/recipes`): faceted filter UI over cuisine/country, spiciness,
  sweetness, richness, effort, dietary tags, total time, difficulty. Server-rendered
  via Payload's local API against Postgres; filter state in the URL (shareable,
  SEO-friendly).
- **Cuisine hubs** (`/cuisine/[slug]`): SEO landing pages per country/cuisine.
- **Recipe page** (`/recipes/[slug]`): the hero experience — photography-forward,
  recipe-first, brand slot integrated tastefully, structured `Recipe` JSON-LD.
- **Home**: editorial, emotionally-anchored entry that invites *exploration* (the hard,
  defensible part), not just a search box.

---

## 8. SEO (the legitimate superpower)

**No cloaking / hidden keywords — that is manual-de-index bait and is off the table.**
The sanctioned, more powerful version:

- **`Recipe` JSON-LD** on every recipe page (name, image, author, ratings, times,
  ingredients, instructions, nutrition). This is what earns the rich cards with star
  ratings + photo carousel at the top of Google — invisible to users, fully legit.
- Clean semantic URLs, per-page OG images, `sitemap.xml`, `robots.txt`.
- SSG/ISR for recipe + cuisine pages (fast = ranks + converts).
- Canonical/attribution discipline on any `api-imported` content to avoid
  duplicate-content penalties.

---

## 9. MVP scope (Phase 1 "done")

**In:**
- Payload + Postgres + `recipes`/`brandCards`/`cuisines`/`authors` collections
  (+ `submissions` schema, unused)
- 30–50 human-verified recipes loaded
- Home, catalog w/ faceted filters, cuisine hubs, recipe page
- Hand-curated brand-card slots + affiliate links + clean rotation function
- Full `Recipe` JSON-LD, sitemap, OG images
- Responsive, distinctive design system
- Deployed to Vercel

**Explicitly out (deferred, not forgotten):**
- Ad *engine* (targeting service, impression/click tracking) → Phase 2
- Self-serve brand portal → Phase 3
- User accounts, community submission UI → later (schema ready)
- Live API ingestion → later (mapper designed)
- Search-as-you-type, personalization, saved/favorite recipes

---

## 10. Success criteria

- A stranger lands on a recipe and can cook from it in under 10 seconds of arriving —
  no scroll-past-the-story.
- Recipe pages validate in Google's Rich Results test (Recipe schema).
- Adding a recipe or a brand card requires **zero code** (done in `/admin`).
- Swapping a brand card in/out is a CMS edit, and rotation stays fair automatically.
- The site is visibly *not* a template — it has a point of view.

---

## 11. Open questions (resolve during planning, not blocking)

1. Product name + domain.
2. Which affiliate program(s) first — Amazon Fresh, Instacart, or a grocery API?
3. Exact taste-axis vocabulary shown to users (numbers vs. labels like "mild → fiery").
4. Image sourcing for the launch catalog (original photography vs. licensed vs.
   AI-generated food imagery — each has quality + rights implications).
5. Which external recipe API to design the Phase-2 mapper against.
