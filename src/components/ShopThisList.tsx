'use client'

import { useEffect, useMemo, useState } from 'react'

import { Disclosure } from '@/components/Disclosure'
import { retailersForCountry, shoppingListText } from '@/lib/grocery'

export type ShopRetailer = {
  id: number | string
  label: string
  slug: string
  countries: Array<{ code: string }>
  priority: number
  active: boolean
}
export type ShopLine = { key: string; name: string; amounts: string[] }

const COUNTRY_KEY = 'palate:shop-country'

/** ISO-2 → readable name, for the picker. Falls back to the code itself. */
const countryName = (code: string): string => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * The grocery handoff panel: pick a retailer, every netted shopping line
 * becomes a tracked search link, opened in a new tab (links go through
 * /grocery/click so the destination is rebuilt server-side and logged).
 *
 * The country is the viewer's decision, not the IP header's: the header only
 * sets the default; a picker covers VPNs, travel and dev, and the choice
 * persists locally. An uncovered country keeps the Copy-list button and says
 * so honestly instead of vanishing — the old contract of rendering nothing
 * made the panel look broken from most of the world.
 */
export function ShopThisList({
  retailers,
  defaultCountry,
  lines,
}: {
  retailers: ShopRetailer[]
  defaultCountry: string | null
  lines: ShopLine[]
}) {
  const [country, setCountry] = useState<string | null>(defaultCountry)
  const [active, setActive] = useState<ShopRetailer | null>(null)
  const [copied, setCopied] = useState(false)

  // A remembered choice beats the header — read after mount so hydration
  // matches the server render of the header-detected default.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COUNTRY_KEY)
      if (saved) setCountry(saved)
    } catch {
      /* storage unavailable — the header default stands */
    }
  }, [])

  const eligible = useMemo(() => retailersForCountry(retailers, country), [retailers, country])

  // Countries worth offering: only the ones at least one retailer serves.
  const covered = useMemo(() => {
    const codes = new Set<string>()
    for (const r of retailers) for (const c of r.countries) codes.add(c.code.toUpperCase())
    return [...codes]
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [retailers])

  // Keep the active retailer valid as the country changes.
  useEffect(() => {
    setActive((prev) =>
      prev && eligible.some((r) => r.slug === prev.slug) ? prev : (eligible[0] ?? null),
    )
  }, [eligible])

  const pickCountry = (code: string) => {
    setCountry(code)
    try {
      window.localStorage.setItem(COUNTRY_KEY, code)
    } catch {
      /* fine — the choice still applies for this visit */
    }
  }

  if (lines.length === 0) return null

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(shoppingListText(lines))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="mt-6">
      <Disclosure
        title={<span className="font-display text-[1.125rem] text-ink">Shop this list</span>}
        meta={active ? active.label : country ? countryName(country) : undefined}
        defaultOpen={false}
      >
        <div className="flex flex-wrap items-center gap-2">
          {eligible.map((r) => (
            <button
              key={r.slug}
              type="button"
              aria-pressed={active?.slug === r.slug}
              onClick={() => setActive(r)}
              className={`chip ${active?.slug === r.slug ? 'border-ink bg-ink text-paper' : ''}`}
            >
              {r.label}
            </button>
          ))}
          <button type="button" onClick={() => void copy()} className="chip ml-auto">
            {copied ? 'Copied ✓' : 'Copy list'}
          </button>
        </div>

        {eligible.length === 0 && (
          <p className="mt-3 mb-0 text-[0.875rem] text-slate">
            No shops listed for {country ? countryName(country) : 'your country'} yet — copy the
            list and take it anywhere.
          </p>
        )}

        {active && (
          <ul className="mt-3 grid list-none gap-1.5 p-0">
            {lines.map((line) => (
              <li key={line.key}>
                <a
                  href={`/grocery/click?r=${active.id}&q=${encodeURIComponent(line.name)}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="group flex items-baseline justify-between gap-3 border-b border-dotted border-rule pb-1.5 no-underline"
                >
                  <span className="text-[0.9375rem] text-ink group-hover:text-flame">
                    {line.name}
                    {line.amounts.length > 0 && (
                      <span className="text-slate"> — {line.amounts.join(' + ')}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase group-hover:text-flame">
                    find at {active.label} ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <label className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
          Shopping somewhere else?
          <select
            value={country && covered.some((c) => c.code === country) ? country : ''}
            onChange={(e) => pickCountry(e.target.value)}
            className="rounded border border-rule bg-transparent px-2 py-1 font-mono text-[0.75rem] text-ink focus:border-flame focus:outline-none"
          >
            <option value="" disabled>
              Pick a country
            </option>
            {covered.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </Disclosure>
    </div>
  )
}
