'use client'

import { useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

import { deliveryFigures } from '@/lib/brandCards/delivery'

/**
 * How this card is actually doing.
 *
 * adEvents has logged an impression and a click row since the slot shipped, and
 * nothing ever surfaced them per card — creators could see aggregates through
 * /studio/earnings while the person deciding whether to keep a campaign running
 * could only page through raw rows. Delivery you cannot see is delivery you
 * cannot manage.
 *
 * Counts come from Payload's own REST API with the admin's session, using
 * `limit=0` so the database returns totals without shipping any rows. No new
 * endpoint, and no way for this to read anything the editor could not already
 * read by hand.
 */

type Counts = { impressions: number; clicks: number } | null

const fmt = new Intl.NumberFormat('en-GB')

async function countEvents(cardId: string | number, kind: 'impression' | 'click'): Promise<number> {
  const params = new URLSearchParams({
    'where[brandCard][equals]': String(cardId),
    'where[kind][equals]': kind,
    limit: '0',
    depth: '0',
  })
  const res = await fetch(`/api/adEvents?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error(String(res.status))
  const body = await res.json()
  return Number(body?.totalDocs ?? 0)
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--theme-elevation-500)' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>{hint}</div>}
    </div>
  )
}

export function BrandCardStats() {
  const { id } = useDocumentInfo()
  const [counts, setCounts] = useState<Counts>(null)
  const [failed, setFailed] = useState(false)

  const cap = useFormFields(([f]) => f?.maxImpressions?.value as number | null | undefined)
  const served = useFormFields(([f]) => (f?.impressionsServed?.value as number | null) ?? 0)

  useEffect(() => {
    if (!id) return
    let live = true
    Promise.all([countEvents(id, 'impression'), countEvents(id, 'click')])
      .then(([impressions, clicks]) => {
        if (live) setCounts({ impressions, clicks })
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [id])

  // Nothing to report before the card exists.
  if (!id) {
    return (
      <div className="field-type">
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>
          Delivery appears here once this card has been saved and served.
        </p>
      </div>
    )
  }

  const figures = deliveryFigures({
    impressions: counts?.impressions ?? 0,
    clicks: counts?.clicks ?? 0,
    served,
    cap,
  })
  const hasCap = figures.percentServed !== null
  const pct = figures.percentServed ?? 0
  const ctr = figures.ctr ?? '—'

  return (
    <div className="field-type">
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
        <strong>Delivery</strong>
      </div>

      {failed ? (
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>
          Could not load delivery figures. The card itself is unaffected.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
            <Stat label="Impressions" value={counts ? fmt.format(counts.impressions) : '…'} />
            <Stat label="Clicks" value={counts ? fmt.format(counts.clicks) : '…'} />
            <Stat
              label="Click rate"
              value={counts ? ctr : '…'}
              hint={counts && counts.impressions === 0 ? 'no impressions yet' : undefined}
            />
          </div>

          {hasCap && (
            <div style={{ marginTop: '1rem', maxWidth: '26rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
                <span>{fmt.format(served)} of {fmt.format(cap ?? 0)} bought</span>
                <span>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--theme-elevation-150)', marginTop: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--theme-elevation-800)' : '#e4572e' }} />
              </div>
              {figures.spent && (
                <p style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                  This campaign has served its buy and is no longer being shown.
                </p>
              )}
            </div>
          )}

          {counts && counts.impressions !== served && (
            /* The counter on the card is a running total kept for selection to
               read cheaply; the log is the record of truth. Saying so beats
               having someone find two numbers and trust the wrong one. */
            <p style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--theme-elevation-500)' }}>
              The counter reads {fmt.format(served)} against {fmt.format(counts.impressions)} logged
              events. The log is the record; the counter is a running total selection reads on every
              render, and can be recomputed from the log.
            </p>
          )}
        </>
      )}
    </div>
  )
}
