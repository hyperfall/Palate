import { BRAND_CTA_CLASS, BrandCardFace } from '@/components/BrandCardFace'

/**
 * The placement, shown to the person buying it.
 *
 * The advertise page described a partner card in prose and never showed one, so
 * a brand was asked to commit budget and artwork to something they had to
 * imagine. This renders the real component the live slot renders, so what a
 * partner sees here cannot drift from what a reader gets.
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
    <BrandCardFace
      brand={brand}
      tagline={tagline}
      thumb={
        <div
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-sm font-mono text-title font-semibold text-paper"
          style={{ background: swatch }}
        >
          {brand.slice(0, 1)}
        </div>
      }
      // A span, not an anchor: a sample must not be clickable, and must not look
      // like a live placement to a crawler.
      cta={<span className={BRAND_CTA_CLASS}>{ctaLabel}</span>}
    />
  )
}
