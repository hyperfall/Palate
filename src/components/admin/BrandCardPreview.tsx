'use client'

import { useEffect, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

import { BRAND_CTA_CLASS, BRAND_THUMB_CLASS, BrandCardFace } from '@/components/BrandCardFace'
import { liveCreatives } from '@/lib/brandCards/creative'

/**
 * The card as a reader will see it, live, while it is being written.
 *
 * A brand card was edited blind: an editor filled in a brand, a tagline, a
 * button label and an image id, saved, then went and found a recipe the card
 * targeted to discover the tagline ran to three lines. This renders the same
 * BrandCardFace the live slot renders, from the values currently in the form.
 *
 * A campaign can carry several creatives, and only one of them reaches any
 * given reader, so the preview lets an editor step through the set — the point
 * is to check every image that could ship, not just the first.
 *
 * Rendered by a `ui` field: it holds no data of its own and writes nothing.
 */

type CreativeRow = { id: string | number | null; tagline: string | null; active: boolean }

function useMediaUrl(id: string | number | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ id: string | number; url: string | null } | null>(null)

  useEffect(() => {
    if (id === null || id === undefined || id === '') return
    let live = true
    fetch(`/api/media/${id}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (!live) return
        // The card renders the thumbnail size, so preview it at that size too —
        // previewing the full-resolution original would hide a soft crop.
        setLoaded({ id, url: doc?.sizes?.thumbnail?.url ?? doc?.url ?? null })
      })
      .catch(() => {
        if (live) setLoaded({ id, url: null })
      })
    return () => {
      live = false
    }
  }, [id])

  // Derived rather than cleared in the effect. Keying the result to the id it
  // was fetched for means stepping through creatives drops the previous image
  // immediately, instead of showing creative 1's picture under creative 2's
  // tagline until the fetch lands — which is exactly the kind of thing a
  // preview exists to make impossible.
  return loaded && loaded.id === id ? loaded.url : null
}

export function BrandCardPreview() {
  const brand = useFormFields(([f]) => (f?.brand?.value as string) ?? '')
  const tagline = useFormFields(([f]) => (f?.tagline?.value as string) ?? '')
  const ctaLabel = useFormFields(([f]) => (f?.ctaLabel?.value as string) ?? '')
  const logo = useFormFields(([f]) => f?.logo?.value as string | number | undefined)
  const productImage = useFormFields(([f]) => f?.productImage?.value as string | number | undefined)

  const creatives = useFormFields(([f]) => {
    const rows = (f?.creatives as { rows?: unknown[] } | undefined)?.rows ?? []
    return rows.map((_, i): CreativeRow => ({
      id: (f[`creatives.${i}.image`]?.value as string | number | null) ?? null,
      tagline: (f[`creatives.${i}.tagline`]?.value as string | null) ?? null,
      // A row defaults to active; only an explicit false retires it.
      active: f[`creatives.${i}.active`]?.value !== false,
    }))
  })

  // The same rule the runtime uses, so the preview can never show an editor a
  // creative that would not ship, or hide one that would.
  const live = liveCreatives(creatives.map((c) => ({ image: c.id, tagline: c.tagline, active: c.active })))
  const [slot, setSlot] = useState(0)
  // Deleting or retiring rows can leave the cursor past the end.
  const index = live.length > 0 ? Math.min(slot, live.length - 1) : 0
  const chosen = live[index] ?? null

  const imageUrl = useMediaUrl((chosen?.image as string | number | undefined) ?? productImage ?? logo)
  const shownTagline = chosen?.tagline?.trim() || tagline

  if (!brand && !tagline) {
    return (
      <div className="field-type">
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>
          The preview appears once this card has a brand and a tagline.
        </p>
      </div>
    )
  }

  return (
    <div className="field-type">
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          As a reader sees it
        </strong>
        {live.length > 1 && (
          <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.8rem' }}>
            Creative {index + 1} of {live.length}. Each reader sees one
          </span>
        )}
      </div>

      {/* The site's own surface, so the card is judged against the background it
          will actually sit on rather than against the admin's chrome. */}
      <div style={{ background: '#f6f3ec', padding: '1.25rem', borderRadius: '6px', maxWidth: '26rem' }}>
        <BrandCardFace
          brand={brand || 'Brand name'}
          tagline={shownTagline || 'Your one-line tagline goes here.'}
          thumb={
            imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-only preview of a Payload upload
              <img src={imageUrl} alt="" width={64} height={64} className={BRAND_THUMB_CLASS} />
            ) : undefined
          }
          cta={<span className={BRAND_CTA_CLASS}>{ctaLabel || 'Shop now'}</span>}
        />
      </div>

      {live.length > 1 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {live.map((c, i) => (
            <button
              key={`${String(c.image)}-${i}`}
              type="button"
              onClick={() => setSlot(i)}
              aria-current={i === index ? 'true' : undefined}
              className="btn btn--style-secondary btn--size-small"
              style={{ margin: 0, opacity: i === index ? 1 : 0.6 }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {!imageUrl && (
        <p style={{ marginTop: '0.6rem', color: 'var(--theme-elevation-500)', fontSize: '0.8rem' }}>
          No image yet. Add a creative below, or a brand logo above.
        </p>
      )}
    </div>
  )
}
