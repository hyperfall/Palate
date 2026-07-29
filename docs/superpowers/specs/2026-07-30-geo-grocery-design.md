# Geo-based "Shop this list" — design

Approved direction: **country-level retailers from a generated, verified seed**,
plus a viewer-facing country picker. Store-level maps ("shops near me") is
explicitly out of scope — a shopping-list handoff needs a retailer's online
search, not a building.

## What exists (unchanged)

- `GroceryRetailers` Payload collection: label, slug, type, `countries[]`
  (ISO-2; empty = global), `searchUrlTemplate` (`{query}`), optional
  `affiliateUrlTemplate` (`{url}`), priority, active.
- Pure selection in `src/lib/grocery.ts` (`retailersForCountry`, `searchUrl`) —
  shared by server and tests, importable client-side.
- `/grocery/click` rebuilds the destination server-side and logs the click;
  impressions logged per retailer shown.
- Geo: `x-vercel-ip-country` → `GROCERY_DEFAULT_COUNTRY` → `GB`.

The architecture is already geo-based. The gaps: (1) data — 8 retailers,
2 countries; (2) the IP header is the sole authority — wrong on VPNs, absent in
dev, unhelpful for travellers; (3) an uncovered country renders nothing at all.

## Changes

### 1. Registry data (`src/seed/groceryRetailers.ts`)

~30 countries, 2–5 online-grocery retailers each, authored in the existing
`SeedRetailer` shape and seeded idempotently (existing rows never touched, so
admin edits survive). Selection bias: retailers with real online grocery
search; majors first (priority desc). Affiliate templates stay empty until
programs exist — B layers onto A per retailer, never replaces it.

### 2. Verification (`npm run verify:grocery`)

Generated URL templates are exactly where hallucination bites, and retailers
move their search paths. The script imports the seed array (no DB), builds
`searchUrl(retailer, 'olive oil')` for each, fetches with a browser UA and a
timeout, and classifies:

- **PASS** — 2xx after redirects.
- **BOT-BLOCKED** — 403/405/429: reachable, actively refusing bots. Fine for
  humans; listed, not failed.
- **FAIL** — 404, 5xx, DNS/timeout. Fix or drop before seeding.

Exit code 1 on any FAIL so it can gate CI/cron later.

### 3. Country picker (`ShopThisList` + `GroceryPanel`)

`GroceryPanel` fetches the **whole active registry** (~100 rows, trivial) and
passes it with the detected country. The client filters with the same pure
`retailersForCountry`. New picker UI: "Shopping somewhere else?" → country
`<select>` listing only covered countries; choice persisted in
`localStorage('palate:shop-country')` and preferred over the header thereafter.

Uncovered country / no match: panel no longer vanishes — it shows the Copy
list button plus one honest line ("No shops listed for your country yet"), so
the list is still usable anywhere on earth.

Impressions: unchanged server-side for the default-country set (the likely
majority); client-side switches don't log impressions (acceptable undercount,
no new endpoint).

### 4. Testing

- Pure: `retailersForCountry` already covered; add cases for picker-relevant
  behaviour only if logic is added (none planned — same function).
- `verify:grocery` run once now; report results in the commit message.
- Browser: panel on `/plan/shared/sample` — default country, switched country,
  uncovered country fallback.

## Out of scope

Store-level location, opening hours, basket APIs, per-item price comparison,
affiliate sign-ups, fixing retailer-side search quality (amchur→anchor).
