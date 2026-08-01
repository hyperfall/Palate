/**
 * The placement, shown to the person buying it.
 *
 * The advertise page described a partner card in prose and never showed one, so
 * a brand was asked to commit budget and artwork to something they had to
 * imagine. This renders the real thing — same markup, same dashed border, same
 * "— Partner —" label, same uppercase CTA — with the copy swapped for an
 * example, so what a partner sees here is what a reader gets.
 *
 * Deliberately a static server component rather than a call into BrandSlot:
 * that fetches a live rotation for a specific recipe, which is not what a
 * sample should do. The trade is that this markup has to be kept in step with
 * BrandSlot by hand; a shared presentational component would remove that, and
 * is worth doing the next time either changes.
 */
export function PartnerCardExample({
  brand,
  tagline,
  ctaLabel = 'Shop now',
  swatch,
}: {
  brand: string
  tagline: string
  ctaLabel?: string
  /** Stands in for the creative — no real partner artwork exists to show yet. */
  swatch: string
}) {
  return (
    <div className="rounded-md border border-dashed border-slate/60 bg-card p-5">
      <p className="eyebrow m-0">— Partner —</p>

      <div className="mt-3 flex items-start gap-4">
        <div
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-sm font-mono text-[1.25rem] font-semibold text-paper"
          style={{ background: swatch }}
        >
          {brand.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="m-0 font-mono text-[0.875rem] font-semibold text-ink">{brand}</p>
          <p className="mt-1 text-[0.9375rem] leading-snug text-slate">{tagline}</p>
        </div>
      </div>

      {/* A span, not an anchor: a sample must not be clickable, and must not
          look like a live placement to a crawler. */}
      <span className="mt-4 inline-block rounded border border-ink px-4 py-2 font-mono text-[0.8125rem] font-semibold tracking-[0.08em] text-ink uppercase">
        {ctaLabel}
      </span>
    </div>
  )
}
