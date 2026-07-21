# Recipe platform — Phase 1

Implementation of [`docs/2026-07-18-recipe-platform-design.md`](docs/2026-07-18-recipe-platform-design.md).
Section references below (§) point at that spec, which remains the source of truth.

Working wordmark is **Palate** — §11 Q1 is still open. It lives in one constant
(`src/lib/site.ts`), so renaming is a one-line change.

## Stack

Next.js 16 (App Router) · Payload CMS 3 · Postgres · Tailwind CSS 4 · Vercel

## Running it

```bash
createdb recipes_dev          # or point DATABASE_URL at any Postgres
cp .env.example .env          # then set PAYLOAD_SECRET
npm install
npm run seed                  # sample content — see the warning it prints
npm run dev
```

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin

Payload pushes schema automatically in development. Set `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` before seeding to get an admin login, or create the first
user through `/admin` on first visit.

```bash
npm run test:int    # unit + integration (vitest)
npm run test:e2e    # end-to-end (playwright)
npm run build       # production build
```

## What Phase 1 ships

| Spec | Where |
|---|---|
| §5 data model | `src/collections/` — recipes, cuisines, authors, brandCards, media, submissions |
| §6 brand-card rotation | `src/lib/brandCards/select.ts` (pure) + `resolve.ts` (I/O shell) |
| §7 faceted catalog | `src/lib/filters.ts`, `src/components/FilterPanel.tsx` |
| §8 SEO | `src/components/RecipeJsonLd.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts` |
| Design system | `src/app/(frontend)/styles.css`, `src/components/TasteGauge.tsx` |

### The taste axes

Four axes — heat, sweetness, richness, effort — stored as integers 0–5 and
displayed as words ("Fiery", "Effortless"). That resolves §11 Q3: numbers in the
database keep filtering cheap; words on screen mean no one has to decode
"richness: 4".

Catalog filters are **bands, not ceilings**: `spiciness=3-5` means "at least
hot", which a ceiling-only model could never say. Bare numbers in old URLs are
still accepted as ceilings (`spiciness=2` ≡ `0-2`). On the home gauge, flavour
axes read as "at least this much" and effort as "at most" — every graduation
maps to a request a cook would actually make.

The catalog also carries title search (`q`), a sort select, and pagination —
all URL-state, all shareable.

### Design point of view

Colour is data. The page is achromatic — warm paper, ink, soft hairlines — and
the only saturated colour in the system is the four axis hues. There is
deliberately no brand accent: the brand colour is whatever the food tastes
like. The geometry is soft (generous radii, pill controls, low shadows); the
same gauge instrument is used to *read* a recipe and to *filter* the catalog.

Typography inverts the usual pairing. Archivo (engineered, tabular figures)
for interface chrome, Newsreader (a screen-reading serif) for the recipe itself,
because the interface is an instrument and the recipe is a document.

On the recipe page, the ingredients panel carries a servings stepper that
scales numeric quantities in place — anything unquantified ("a large handful")
is left exactly as written, because pretending to scale it would be a lie.

### Why the brand slot loads client-side

`/recipes/[slug]` is statically generated, as §8 requires. The partner card is
per-visitor (region + rotation cookie), so it is fetched separately from
`/brand-slot`. Resolving it during the page render would force the whole route
dynamic — and caching a page that already contains one visitor's partner card
would serve that card to everyone. See `src/app/(frontend)/brand-slot/route.ts`.

## Deliberately not built (§9)

Deferred, with the seams already in place:

- **Ad engine** (targeting service, impression/click logging) → Phase 2.
  `selectBrandCards` is a pure function over data it is handed; swapping the
  data source does not change its callers.
- **Self-serve brand portal** → Phase 3.
- **Community submissions** — the `submissions` collection exists and composes
  the *same* field factories as `recipes` (`src/fields/recipeContent.ts`), so
  turning it on needs no migration. No public submission route exists; create
  and read are both restricted to authenticated users.
- **API ingestion** — `provenance: 'api-imported'` carries required source
  attribution and sets `robots: noindex`, so imported duplicate content cannot
  dilute the authored catalog's ranking (§3, §8).

## Before this goes near a real domain

1. **Replace the seeded recipes.** §3 requires 30–50 recipes that a human has
   cooked and verified. The eight seeded ones are marked `provenance: authored`
   so that path is exercised, but nobody has tested them. An untested recipe is
   a food-safety and trust liability.
2. **Replace the placeholder imagery.** Every seeded image is a generated colour
   field, credited as a placeholder. §11 Q4 (original vs. licensed vs.
   AI-generated) is still open and has rights implications.
3. **Set `NEXT_PUBLIC_SITE_URL`** to the real origin, or the sitemap and
   canonical tags will ship `localhost` URLs.
4. Resolve the remaining §11 questions: product name and domain, first affiliate
   programme, and which external recipe API the Phase-2 mapper targets.
