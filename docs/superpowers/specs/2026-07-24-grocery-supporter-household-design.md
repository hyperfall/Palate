# Grocery commerce + Supporter tier + Household mode

**Date:** 2026-07-24
**Status:** Approved (design)
**Build order:** grocery → supporter → household (household gates on supporter)

## Context & decisions (resolved during brainstorming)

- **Paywall line:** everything shipped today stays free. Supporter (paid) gates
  Household mode now and future perks (Taste Night host mode, taste reports,
  and later "Palate Kitchen" premium recipes/collections, Mob-style). Grocery
  links are free for everyone — affiliate earns regardless of tier.
- **Entitlements are a model, not flags:** gates check entitlement keys from one
  lib so future premium content slots in without rewiring.
- **Payments:** Stripe Checkout + Customer Portal + webhook → Supabase.
- **Grocery:** geo-aware, admin-managed retailer registry (the brandCards
  pattern: country match + priority + click/impression tracking + CTR), search
  handoff links with optional affiliate wrapping. No UK basket API exists
  publicly; handoff+affiliate is v1, upgradeable to a basket API partnership.
- **Household v1:** shared week board + pantry + shopping list. Creating a
  household requires supporter; joining is free (one payer per household).
  One household per user. Taste profiles stay individual.

## Slice 1 — Grocery commerce

**Payload collection `groceryRetailers`** (admin group with BrandCards):
`label`, `slug` (unique), `countries[]` (ISO-2 uppercase), `type`
(supermarket | delivery | marketplace), `searchUrlTemplate` (must contain
`{query}`), optional `affiliateUrlTemplate` (must contain `{url}` when set),
`network` (none | awin | amazon | other), `priority` (desc order), `active`,
`notes`. Doc sidebar shows computed impressions / clicks / CTR via afterRead
count over events (low volume, acceptable).

**Payload collection `groceryEvents`:** `retailer` (rel), `kind`
(impression | click), `country`, `createdAt`. Created server-side only.

**Pure lib `src/lib/grocery.ts`** (unit-tested):
- `retailersForCountry(retailers, country)` — active + country match + priority sort.
- `searchUrl(retailer, query)` — `{query}` URL-encoded substitution; when
  `affiliateUrlTemplate` present, wrap: `{url}` ← encoded search URL.

**Routes:**
- Selection happens server-side in the pages (country from
  `x-vercel-ip-country`, fallback `GROCERY_DEFAULT_COUNTRY` → `GB`); one
  `impression` event logged per retailer shown per panel render, so
  per-retailer CTR is computable.
- `GET /grocery/click?r=<id>&q=<term>` — loads retailer by id, rebuilds the URL
  server-side (client URLs never trusted), logs `click`, 302s. Mirrors
  `/brand-slot/click`.

**UI `ShopThisList` (client):** panel under the shopping list on `/plan` and
`/plan/shared/[token]` (viewers without accounts can shop a shared list).
Retailer chips (geo-picked); selecting one turns each netted "Everything to
buy" line into a search handoff link via the click route; "Copy list" copies
plain text. Renders nothing when no retailer matches (brandCards contract).

**Seed:** `seed:grocery` script inserts sensible defaults (GB: Tesco,
Sainsbury's, Asda, Ocado, Amazon Fresh; US: Walmart, Target, Amazon Fresh) —
admin manages after that. Affiliate templates left empty until programs are
approved; links work without them.

## Slice 2 — Supporter tier

**Supabase `subscriptions`:** `user_id` PK → auth.users, `stripe_customer_id`,
`stripe_subscription_id`, `status`, `price_id`, `current_period_end`,
`updated_at`. RLS: owner may SELECT; no client INSERT/UPDATE — writes go
through the service-role key in the webhook only. Added to `supabase/schema.sql`
idempotently.

**`src/lib/entitlements.ts`:** `entitlementsFor(subscriptionRow)` →
`Set<'supporter'>` when status ∈ {active, trialing} and period end in the
future; `getEntitlements()` server helper reads the row for the signed-in user.
The single extension point for future keys (e.g. `kitchen`).

**Routes:**
- `/support` — supporter pitch page (kitchen-pass voice): what it funds, perks
  now (Household when it ships) and later (host mode, taste reports, Palate
  Kitchen), price label from `NEXT_PUBLIC_SUPPORTER_PRICE_LABEL` (fallback
  "£3.50/month"). Degrades to a "not configured" state without Stripe envs.
- `POST /support/checkout` — auth required; Stripe Checkout Session
  (mode=subscription, `client_reference_id` = Supabase user id, price
  `STRIPE_PRICE_SUPPORTER`); redirects to Stripe.
- `POST /support/portal` — Customer Portal session for manage/cancel.
- `POST /api/stripe/webhook` — raw-body signature verify
  (`STRIPE_WEBHOOK_SECRET`); handles `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted` → upsert
  `subscriptions` via `SUPABASE_SERVICE_ROLE_KEY` client.

**/account:** shows tier ("Supporter" / free) + Manage subscription (portal) /
Become a supporter link.

**Envs (all optional-degrade):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_SUPPORTER`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPPORTER_PRICE_LABEL`.

## Slice 3 — Household mode

**Supabase:**
- `households`: `id` uuid PK, `name`, `owner_id` → auth.users,
  `invite_code` text unique (random, regenerable later), `created_at`.
- `household_members`: (`household_id`, `user_id`) PK, `role`
  (owner | member), `joined_at`; **unique index on `user_id`** (one household
  per user).
- `meal_plan` and `pantry` gain nullable `household_id` via
  `alter table … add column if not exists` (idempotent — the plan_shares
  lesson).
- RLS: existing "own rows" policies extended so a row is accessible when
  `user_id = auth.uid()` **or** `household_id` is one the viewer is a member
  of. Membership rows: members read their household's rows; owner may delete
  members; anyone may delete their own membership (leave).
- `join_household(code)` — security-definer RPC: validates code, inserts
  membership (role member) if the user has none.

**Flows:**
- Create: `POST /household/create` (Next route) — verifies `supporter`
  entitlement server-side, then creates household + owner membership via
  service role.
- Invite: `/household` shows the code + copyable link `/household/join/<code>`;
  visiting it (signed in) calls the RPC and redirects to `/plan`.
- Manage: `/household` page — members list, leave (member), remove member /
  disband (owner; disband deletes household, rows cascade back to nothing —
  members' personal plans are untouched).
- While in a household, `/plan` reads/writes household rows (a chip names the
  household); personal rows are preserved and return when you leave. No
  auto-merge of personal plans into the household (explicitly out of v1).

**Wiring:** `planData.ts` resolves membership once per request and scopes
queries; `AddToPlan`, MealBoard mutations, and ShoppingList "have it" include
`household_id` when present (passed down from the server component); RLS
enforces correctness.

## Testing & verification

- Unit: `grocery.ts` (country match, priority, `{query}`/`{url}` templating,
  encoding), `entitlements.ts` (status × period matrix), plan-data scoping
  shapes. Suite must stay green; `tsc` is the working check.
- Webhook: `stripe.webhooks.constructEvent` exercised in a unit test with a
  test signing secret.
- Browser verification per slice on the running dev server (grocery panel
  renders + click route 302s + events land; /support renders in both
  configured/unconfigured states; household flows are cloud-RLS-gated →
  user-verified, stated honestly).
- **User actions required:** re-run `supabase/schema.sql` after slices 2–3;
  create Stripe product/price + webhook endpoint and set envs; add affiliate
  templates in /admin when programs are approved.
