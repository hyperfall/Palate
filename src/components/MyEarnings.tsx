'use client'

import { useEffect, useState } from 'react'

type Row = { title: string; slug: string; impressions: number; clicks: number; earningsCents: number }
type Earnings = { totalCents: number; recipes: Row[] }

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

/**
 * A creator's estimated partner earnings — total and per recipe, from real
 * impression counts × agreed CPM × their revenue share. Honest by construction:
 * it's labelled an estimate and "paid as the program launches", and it only
 * appears once there's actually something (an impression) to show.
 */
export function MyEarnings() {
  const [data, setData] = useState<Earnings | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/studio/earnings')
      .then((res) => (res.ok ? res.json() : { totalCents: 0, recipes: [] }))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData({ totalCents: 0, recipes: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data || data.recipes.length === 0) return null

  return (
    <section className="mb-10 max-w-[52rem]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow m-0">Estimated earnings</p>
        <p className="m-0 font-mono text-caption text-slate">
          your share · paid as the partner program launches
        </p>
      </div>
      <p className="mt-1.5 font-display text-[1.75rem] leading-none text-ink">{usd(data.totalCents)}</p>

      <ul className="mt-4 grid list-none gap-0 p-0">
        {data.recipes.map((r) => (
          <li
            key={r.slug}
            className="flex items-center justify-between gap-4 border-b border-rule py-2.5"
          >
            <span className="min-w-0 truncate font-body text-note text-ink">{r.title}</span>
            <span className="shrink-0 font-mono text-caption text-slate tabular-nums">
              {r.impressions.toLocaleString()} imp · {r.clicks} clk ·{' '}
              <span className="text-ink">{usd(r.earningsCents)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
