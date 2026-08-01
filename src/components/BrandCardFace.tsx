import type { ReactNode } from 'react'

/**
 * What a partner card looks like. One definition, three callers.
 *
 * The live slot, the sample on the advertise page and the preview in /admin all
 * have to show the same object, and the first two had already drifted into
 * separate copies of the same markup. A third copy for the admin preview would
 * have guaranteed the thing an editor approves stops matching the thing a
 * reader sees — which is the one job a preview has.
 *
 * Presentational only: no fetching, no rotation, no link policy. The caller
 * supplies the thumbnail and the call to action, because those are exactly the
 * parts that legitimately differ — a live card needs a sponsored anchor, a
 * sample must not be clickable at all, and the preview is inert by nature.
 */
export function BrandCardFace({
  brand,
  tagline,
  thumb,
  cta,
}: {
  brand: string
  tagline: string
  /** The 64px square. Omitted when a card has no image at all. */
  thumb?: ReactNode
  cta: ReactNode
}) {
  return (
    <div className="rounded-md border border-dashed border-slate/60 bg-card p-5">
      {/*
        §1's wager is that this site is the honest opposite of ad-farming, which
        only holds if a partner card can never be mistaken for editorial. The
        label is part of the component, not of any one caller, so no future
        placement can quietly ship without it.
      */}
      <p className="eyebrow m-0">— Partner —</p>

      <div className="mt-3 flex items-start gap-4">
        {thumb}
        <div className="min-w-0">
          <p className="m-0 font-mono text-[0.875rem] font-semibold text-ink">{brand}</p>
          <p className="mt-1 text-[0.9375rem] leading-snug text-slate">{tagline}</p>
        </div>
      </div>

      <div className="mt-4">{cta}</div>
    </div>
  )
}

/** The CTA's look, shared so a live link and an inert sample cannot diverge. */
export const BRAND_CTA_CLASS =
  'inline-block rounded border border-ink px-4 py-2 font-mono text-[0.8125rem] font-semibold tracking-[0.08em] text-ink uppercase no-underline transition-colors hover:bg-ink hover:text-paper'

/** The 64px square, shared for the same reason. */
export const BRAND_THUMB_CLASS = 'h-16 w-16 shrink-0 rounded-sm object-cover'
