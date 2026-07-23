# Partner Advertising — Intake, Approval & Trust Pages

**Date:** 2026-07-23
**Status:** Approved, building

## Context

The geo-targeted, recipe-relevant, fair-rotation **brand-card engine already
exists and is live** (`src/lib/brandCards/*`, `BrandCards` collection,
`BrandSlot`, `/brand-slot` route). It selects a card by viewer country
(`x-vercel-ip-country`) × recipe/cuisine relevance, rotates fairly (nginx
SWRR), and renders nothing when there is no match. What's missing is the
**front door**: a way for partners to request placement, an approval queue,
the legal/trust pages that make advertising legitimate, and a creator
revenue-share baseline.

This does **not** rebuild the engine. It adds intake + approval + content.

## Revenue-share baseline (researched)

The right analog is the **content-platform model**, where the platform owns
the destination and the ad relationship and the creator contributes content
— i.e. **YouTube: 55% creator / 45% platform** (industry standard since 2007).
The *publisher* model (Mediavine/Raptive ~75% to the site owner) does **not**
apply — there the creator owns their own site and only rents ad-tech; here
Palate owns the site.

**Baseline chosen: 50% creator / 50% platform.** References the 55/45 standard
but tilts modestly to the platform for a new, profit-seeking business; still far
above TikTok (~8%) and Instagram Reels (0%), so it stays a real recruiting
pitch. Stored as a single configurable constant + per-card field so it's a
one-line change to refine later.

> Honest limit: real rev-share needs impression/click tracking, deliberately
> deferred to the engine's "Phase 2". For now we store the % and state the
> policy; **money cannot actually accrue until tracking ships.**

## Scope

### A. Trust & content pages
- `/about` — who Palate is, the cook-first / creator-authored ethos, the honest
  ad stance (labeled, from-your-country, never editorial).
- `/terms` — Terms of Use + a dedicated **Advertising & Partners** section:
  ad labeling, `sponsored`/`nofollow` disclosure, the 50% creator rev-share
  policy, right to decline/remove partners.
- `/privacy` — plain-English privacy/cookie note: IP-country used to target ads,
  the rotation cookie, cookie consent, no selling of personal data.
- All wired into `SiteFooter` (a legal/company row).
- Templates reflecting actual practice — **not legal advice**; owner to review.

### B. Partner intake + approval
- Public `/partners` page ("Advertise with us"): what the slot is (geo- +
  recipe-targeted, labeled), then a request form.
- `PartnerRequestForm` (client) → `POST /partners/apply` → creates a
  `partnerRequests` doc (server-side local API; public create access stays off).
- New `partnerRequests` collection, moderated (`pending`/`approved`/`declined`),
  admin group "Partnerships".
- **Approval hook** (mirrors `Submissions → recipes`): on `status → approved`
  (once), scaffold an **inactive draft `brandCard`** pre-filled from the request
  (brand = company, ctaUrl = website, tagline from `promoting` truncated to 160,
  targetRegions carried over, `active: false`, `revSharePercent` = default).
  Admin then adds creative (logo/product image), assigns recipes/cuisines, and
  flips `active`. Store the scaffolded card id back on the request.

### C. Creator revenue-share (data + policy)
- `DEFAULT_CREATOR_REV_SHARE = 50` in `src/lib/partners.ts`.
- `revSharePercent` field on `brandCards` (number, 0–100, default 50).
- Policy stated on `/terms`. Accrual/payout deferred (needs Phase-2 tracking).

### D. Custom admin dashboard — **deferred.**
Payload `/admin` already gives the approve/decline queue (status column) and
per-recipe/country assignment once B lands. Revisit only if it gets in the way.

## Data model

**`partnerRequests`** (new collection):
| field | type | notes |
|---|---|---|
| company | text, required | useAsTitle |
| website | text, required | becomes card ctaUrl |
| contactName | text, required | |
| contactEmail | email, required | |
| promoting | textarea, required | what they'd advertise → card tagline seed |
| targetRegions | array `{code}` | ISO codes, same shape as brandCards |
| budgetRange | select | under-500 / 500-2k / 2k-10k / 10k-plus / not-sure |
| message | textarea | optional |
| status | select | pending / approved / declined; default pending; sidebar; index |
| reviewNotes | textarea | internal |
| scaffoldedCard | relationship→brandCards | readOnly; set on approve |

Access: read/create/update/delete = `Boolean(req.user)` (admin only). Public
submissions go through the server route via local API (`overrideAccess`).

**`brandCards`**: add `revSharePercent` (number, min 0, max 100, default 50) in
a new "Commercials" tab.

## Files
- Create: `src/lib/partners.ts` (constant + budget options + apply validation)
- Create: `src/collections/PartnerRequests.ts`
- Modify: `src/collections/BrandCards.ts` (revSharePercent), `src/payload.config.ts` (register)
- Create: `src/app/(frontend)/about/page.tsx`, `terms/page.tsx`, `privacy/page.tsx`
- Create: `src/app/(frontend)/partners/page.tsx`, `partners/apply/route.ts`
- Create: `src/components/PartnerRequestForm.tsx`
- Modify: `src/components/SiteFooter.tsx` (legal/company links)

## Verification
- `tsc` clean; existing brand-card tests stay green.
- New pages render (About/Terms/Privacy/Partners) — browser check at mobile +
  desktop; headers kept mobile-compact (don't repeat the big-title problem).
- `/partners/apply` happy-path + validation-rejection via the route.
- Approval hook (scaffold draft card) is admin-only → user-verified in `/admin`;
  logic mirrors the proven Submissions hook and is covered by reasoning + tsc.
