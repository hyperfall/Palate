# Creator socials + hover profile card

**Date:** 2026-07-25
**Status:** Approved (design)

## Goal

Help browsing users discover the creator behind a recipe. Add social links to the
creator profile and surface a hover/tap **profile card** wherever a recipe names
its author, so someone who stumbles onto a dish can jump to the creator's
profile and socials.

## Decisions (from brainstorming)

- **Socials:** a curated icon set — Instagram, TikTok, YouTube, X/Twitter,
  website. Optional, stored as full URLs (creator pastes their link).
- **Hover card placement:** the recipe-page byline AND catalog recipe cards.
- **Touch:** tapping the author opens the card (a "View profile" button inside),
  so socials are reachable on mobile.

## 1. Data — socials on `Authors`

Add a `socials` group to `src/collections/Authors.ts`:
`instagram`, `tiktok`, `youtube`, `x`, `website` — optional `text` fields, each
validated as an http(s) URL when set. Regenerate payload-types.

## 2. Creator self-service editing

- `GET /account/socials` — returns the signed-in creator's current socials (and
  whether they have a profile yet), like `/account/bio`.
- `POST /account/socials` — validates + saves to the creator's author row,
  server-authed on the Supabase user → `creatorId`. Public write off.
- `SocialLinksField` in `AccountPanel` (creator-only, beside the bio editor):
  five inputs with inline URL validation; "Save" like the bio field.
- Shared validation in `src/lib/socials.ts` (pure, tested): normalize + validate
  a URL, and the platform list (key, label, icon, base for display).

## 3. Hover profile card

- **`CreatorHoverCard`** (client): avatar, name, verified tick, bio, social
  icons, "View profile →". Presentational; takes card data.
- **`CreatorByline`** (client): renders the author name / `@handle` as the
  trigger. Desktop: opens on hover (small open/close delay). Touch: opens on
  tap. Accessible — the trigger is a button with `aria-expanded`; Esc and
  outside-click close; focus moves into the card. Lazy-fetches card data on
  first open from `GET /creator/card?handle=…` and caches it in a module-level
  map so repeat hovers and multiple cards for the same creator fetch once.
- **`GET /creator/card?handle=…`** — returns `{ name, handle, verified,
  avatarUrl, bio, socials }` for one author (public, read-only, minimal).
- **Placement:**
  - Recipe page: replace the inline "Written by … @handle" with `CreatorByline`.
  - `RecipeCard`: add a small "by @handle" line using `CreatorByline` (author is
    already populated at depth 1; no extra list query).

## 4. Profile page

`/creator/[handle]` header gains a social-icons row (same curated set), linking
out with `rel="me nofollow"`, opening in a new tab.

## Components & files

- **Changed:** `Authors.ts` (+socials), `payload-types.ts` (regen),
  `AccountPanel.tsx` (+SocialLinksField), recipe `[slug]/page.tsx` (byline swap),
  `RecipeCard.tsx` (+byline), `creator/[handle]/page.tsx` (+socials row).
- **New:** `src/lib/socials.ts` (pure), `account/socials/route.ts`,
  `creator/card/route.ts`, `CreatorHoverCard.tsx`, `CreatorByline.tsx`,
  `SocialIcons.tsx` (inline SVGs).

## Testing

- Unit: `socials.ts` — URL validation (accept/reject), per-platform list shape.
- `tsc` clean; suite green.
- **Live-verifiable (public):** hover + tap open the card on a recipe page and a
  catalog card; lazy fetch fires once and caches; "View profile" navigates;
  socials render. The creator *editing* flow is auth-gated → user-verified.

## Non-goals (v1)

- Follower counts / social metrics.
- OAuth-verified social ownership (links are self-entered).
- Editing socials from anywhere but Settings.
