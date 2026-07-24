# Account menu + Dashboard, Studio as submit-only

**Date:** 2026-07-24
**Status:** Approved (design)

## Problem

`/studio` does two unrelated jobs on one page: the submission form *and*
`MySubmissions` (the creator's whole recipe list, hard-capped at 100 with no
search or pagination) *and* `MyEarnings`. A creator with 250 recipes sees only
100, and returning creators must scroll past their portfolio to submit — or past
a submit form to find a recipe. Managing and creating should be separate.

## Decisions (from brainstorming)

- Account icon → a **dropdown menu** (profile header, then Dashboard · Settings ·
  Studio [creators] · Feed · Sign out). "Notifications" from the reference is
  replaced by **Feed** (`/feed` exists; a notification system does not, and the
  account copy promises "no notifications").
- **Everyone gets a `/dashboard`.** Cooks: overview cards. Creators: also the
  recipes portfolio + earnings summary.
- Routes: **keep `/account` as Settings**, add **`/dashboard`** (no redirect
  churn; sign-in redirects stay valid).
- Earnings on the dashboard: a **separate summary card** (reuse `MyEarnings`),
  not merged into each recipe row (v1 simplicity).
- "Saved" is reachable from the Dashboard overview + footer; **not** a separate
  menu item (keeps the menu tight).

## 1. Account dropdown — `NavAccount` rewrite

The avatar becomes a menu button (`aria-haspopup="menu"`, `aria-expanded`), not a
link. It opens an absolutely-positioned card:
- Header: avatar + display name + email.
- Items: Dashboard → `/dashboard`, Settings → `/account`, Studio → `/studio`
  (creators only), Feed → `/feed`, Sign out (flame; calls `supabase.auth.signOut`).
- Behaviour: Esc and outside-click close; focus moves to the first item on open;
  visible focus rings; each navigation closes it. The previous inline
  "Studio"/"Saved" links are removed (now in menu / dashboard). ThemeToggle stays
  beside the avatar. Signed out → "Sign in" link (unchanged).

## 2. `/dashboard` — new signed-in home

Server component, `dynamic = 'force-dynamic'`, auth-gated (signed-out → sign-in
prompt, mirroring `/plan`).
- **Overview cards (all users):** Saved (count → `/collections`), This week
  (planned-dish count → `/plan`), Household (name or "Cook with others" →
  `/household`).
- **Creators — "Your recipes":** a `CreatorRecipes` client component:
  - Search box (title contains), status filter (All / Published / In review /
    Not accepted), **server pagination** (~20/page) with prev/next + count.
  - Row: title (links to the live recipe when published), status pill, date.
  - A prominent **"New recipe → /studio"** button.
- **Creators — earnings:** the existing `MyEarnings` component as a summary card.

## 3. `/studio` — submit-only

`StudioForm` drops `<MySubmissions />` and `<MyEarnings />`. The page keeps the
"how publishing works" steps + the form, and adds a "See your recipes →
`/dashboard`" link. `MySubmissions` is superseded by `CreatorRecipes`; its fetch
logic is folded in and the component removed.

## 4. Scale the list — `/studio/submissions` route

Add query params: `page` (default 1), `q` (title search), `status` (moderation
filter). Return `{ submissions, total, page, pageSize }`. Drop the `limit: 100`
cap; page at 20. Still server-authed on the Supabase user id — a creator only
ever sees their own. Status stays mapped to the honest creator-facing labels.

## 5. Mobile — `MobileNav`

Phones have no hover; the bottom sheet already carries an account section. It
grows to mirror the dropdown: profile header (avatar + @handle + email) then
Dashboard · Settings · Studio (creators) · Feed · Sign out. Bottom-bar tabs and
`TAB_HREFS` are unchanged; only the sheet's account block is rewritten.

## 6. Settings — `/account`

Functionally unchanged (username, avatar, bio, membership/SupporterStatus, sign
out). Copy shifts from the "your shelf behind the pass" framing to "Settings",
since Saved/Dashboard now own that surface. Eyebrow → "Account", heading →
"Settings".

## Components & files

- **New:** `src/app/(frontend)/dashboard/page.tsx`, `src/components/AccountMenu.tsx`
  (the dropdown; `NavAccount` becomes a thin wrapper or is rewritten in place),
  `src/components/CreatorRecipes.tsx`.
- **Changed:** `NavAccount.tsx`, `MobileNav.tsx`, `StudioForm.tsx`,
  `studio/submissions/route.ts`, `account/page.tsx` (copy).
- **Removed:** `MySubmissions.tsx` (folded into `CreatorRecipes`).
- **Reused:** `MyEarnings.tsx`.

## Testing

- Pagination/search/status is pure query-param handling in the route + a client
  list; verify in-browser on the dev server (creator flows are auth-gated →
  the signed-in portion is user-verified, stated honestly).
- `tsc` clean; existing suite stays green (no pure-lib logic changes expected).
- Menu + mobile sheet: keyboard (Esc/outside-click/focus) and both themes.

## Non-goals (v1)

- Editing a published recipe from the dashboard (submissions are moderated;
  editing is a separate flow).
- Merged per-row earnings/impressions (summary card only).
- A real notifications system.
